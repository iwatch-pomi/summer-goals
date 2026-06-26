import { ChallengeStatus, SettlementStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { stripe } from "./stripe";

// ===========================================================================
// 8月末の部分返金（精算）ロジック
// docs/DESIGN.md 「タスク2-3: 部分返金バッチ」
//
// 返金額 = min(報告成功日数 × dailyForfeitYen, depositYen)  ← 上限 ¥3,000
// 失効額 = depositYen − 返金額（＝運営利益。参加費 ¥500 は別途確保）
//
// JPY はゼロ桁通貨のため amount は「円そのまま」。
// 二重返金は idempotencyKey + settlementStatus で防止する。
// ===========================================================================

export interface SettlementSummary {
  evaluated: number;
  refunded: number;
  noRefund: number;
  failed: number;
  totalRefundedYen: number;
}

/** 1 チャレンジ分の精算（返金）を実行する。 */
export async function settleChallenge(challengeId: string): Promise<
  "REFUNDED" | "NO_REFUND" | "REFUND_FAILED" | "SKIPPED"
> {
  const c = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (
    !c ||
    c.status !== ChallengeStatus.ACTIVE ||
    c.settlementStatus !== SettlementStatus.PENDING ||
    c.paymentStatus !== "PAID"
  ) {
    return "SKIPPED";
  }

  // 報告成功日数 = 期間内の distinct な報告日数。
  const days = await prisma.report.findMany({
    where: {
      challengeId: c.id,
      reportDate: { gte: c.startDate, lte: c.endDate },
    },
    distinct: ["reportDate"],
    select: { reportDate: true },
  });
  const successDays = days.length;

  const refundAmount = Math.min(successDays * c.dailyForfeitYen, c.depositYen);
  const forfeited = c.depositYen - refundAmount;

  try {
    let refundId: string | null = null;

    if (refundAmount > 0) {
      // payment_intent でも charge でも返金可能。要件どおり PaymentIntent を使用。
      const refund = await stripe.refunds.create(
        {
          payment_intent: c.stripePaymentIntentId ?? undefined,
          amount: refundAmount, // 円そのまま（×100 しない）
          metadata: {
            challengeId: c.id,
            successDays: String(successDays),
          },
        },
        { idempotencyKey: `refund_${c.id}` } // 二重返金を防ぐ
      );
      refundId = refund.id;
    }

    await prisma.challenge.update({
      where: { id: c.id },
      data: {
        successDays,
        refundAmountYen: refundAmount,
        forfeitedYen: forfeited,
        stripeRefundId: refundId,
        settlementStatus:
          refundAmount > 0
            ? SettlementStatus.REFUNDED
            : SettlementStatus.NO_REFUND, // amount=0 は Stripe が拒否するため呼ばない
        status: ChallengeStatus.SETTLED,
        settledAt: new Date(),
      },
    });

    return refundAmount > 0 ? "REFUNDED" : "NO_REFUND";
  } catch (err) {
    await prisma.challenge.update({
      where: { id: c.id },
      data: { settlementStatus: SettlementStatus.REFUND_FAILED },
    });
    console.error(`[settlement] refund failed for ${c.id}:`, err);
    return "REFUND_FAILED";
  }
}

/**
 * 期間終了済みの全 ACTIVE チャレンジを精算する。
 * @param now 基準日時（既定: 現在）。endDate <= now のものが対象。
 */
export async function runSettlement(now: Date = new Date()): Promise<SettlementSummary> {
  const targets = await prisma.challenge.findMany({
    where: {
      status: ChallengeStatus.ACTIVE,
      settlementStatus: SettlementStatus.PENDING,
      paymentStatus: "PAID",
      endDate: { lte: now },
    },
    select: { id: true },
  });

  const summary: SettlementSummary = {
    evaluated: 0,
    refunded: 0,
    noRefund: 0,
    failed: 0,
    totalRefundedYen: 0,
  };

  for (const t of targets) {
    summary.evaluated += 1;
    const result = await settleChallenge(t.id);
    if (result === "REFUNDED") {
      summary.refunded += 1;
      const c = await prisma.challenge.findUnique({
        where: { id: t.id },
        select: { refundAmountYen: true },
      });
      summary.totalRefundedYen += c?.refundAmountYen ?? 0;
    } else if (result === "NO_REFUND") {
      summary.noRefund += 1;
    } else if (result === "REFUND_FAILED") {
      summary.failed += 1;
    }
  }

  return summary;
}
