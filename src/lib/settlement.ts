import { ChallengeStatus, SettlementStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { stripe, GRACE_DAYS } from "./stripe";

// ===========================================================================
// 8月末の部分返金（精算）ロジック
// docs/DESIGN.md 「タスク2-3: 部分返金バッチ」
//
// 返金額 = min(報告成功日数 × dailyForfeitYen, depositYen)  ← 上限 ¥3,000
// 失効額 = depositYen − 返金額（＝運営利益。参加費 ¥500 は別途確保）
//
// JPY はゼロ桁通貨のため amount は「円そのまま」。
// 二重返金は idempotencyKey + settlementStatus で防止する。
//
// ★ Vercel Hobby（関数60秒上限）対策:
//   runSettlement は「ページ単位（limit）＋時間予算（timeBudgetMs）」で処理する。
//   処理済みは settlementStatus が PENDING から外れるため、残りは次回呼び出しで
//   自然に続きから処理される（オフセット不要・重複なし）。hasMore で残有無を返す。
// ===========================================================================

export interface SettlementSummary {
  evaluated: number;
  refunded: number;
  noRefund: number;
  failed: number;
  totalRefundedYen: number;
  hasMore: boolean; // まだ未精算のチャレンジが残っている可能性があるか
}

export interface SettleChallengeResult {
  status: "REFUNDED" | "NO_REFUND" | "REFUND_FAILED" | "SKIPPED";
  refundAmountYen: number;
}

/** 1 チャレンジ分の精算（返金）を実行する。 */
export async function settleChallenge(
  challengeId: string
): Promise<SettleChallengeResult> {
  const c = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (
    !c ||
    c.status !== ChallengeStatus.ACTIVE ||
    c.settlementStatus !== SettlementStatus.PENDING ||
    c.paymentStatus !== "PAID"
  ) {
    return { status: "SKIPPED", refundAmountYen: 0 };
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

  // 猶予日数（GRACE_DAYS）分を成功日数に加算 → その日数までの未報告は失効しない。
  const refundAmount = Math.min(
    (successDays + GRACE_DAYS) * c.dailyForfeitYen,
    c.depositYen
  );
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

    return {
      status: refundAmount > 0 ? "REFUNDED" : "NO_REFUND",
      refundAmountYen: refundAmount,
    };
  } catch (err) {
    await prisma.challenge.update({
      where: { id: c.id },
      data: { settlementStatus: SettlementStatus.REFUND_FAILED },
    });
    console.error(`[settlement] refund failed for ${c.id}:`, err);
    return { status: "REFUND_FAILED", refundAmountYen: 0 };
  }
}

export interface RunSettlementOptions {
  /** 1回の呼び出しで処理する最大件数（既定 50）。 */
  limit?: number;
  /** 経過時間がこれを超えたら処理を打ち切る（ミリ秒。既定: 無制限）。 */
  timeBudgetMs?: number;
}

/**
 * 期間終了済みの ACTIVE チャレンジを精算する（1ページ分）。
 * - `limit` 件まで処理し、`timeBudgetMs` を超えたら途中で打ち切る。
 * - 残りがあれば `hasMore=true`。処理済みは PENDING から外れるので、
 *   再度呼べば続きから処理される（オフセット不要・重複なし）。
 * @param now 基準日時（既定: 現在）。endDate <= now のものが対象。
 */
export async function runSettlement(
  now: Date = new Date(),
  options: RunSettlementOptions = {}
): Promise<SettlementSummary> {
  const limit = options.limit ?? 50;
  const timeBudgetMs = options.timeBudgetMs ?? Number.POSITIVE_INFINITY;
  const startedAt = Date.now();

  const targets = await prisma.challenge.findMany({
    where: {
      status: ChallengeStatus.ACTIVE,
      settlementStatus: SettlementStatus.PENDING,
      paymentStatus: "PAID",
      endDate: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const summary: SettlementSummary = {
    evaluated: 0,
    refunded: 0,
    noRefund: 0,
    failed: 0,
    totalRefundedYen: 0,
    hasMore: false,
  };

  let brokeEarly = false;
  for (const t of targets) {
    // 時間予算を超えたら打ち切り（残りは次回呼び出しで継続）。
    if (Date.now() - startedAt > timeBudgetMs) {
      brokeEarly = true;
      break;
    }
    const r = await settleChallenge(t.id);
    summary.evaluated += 1;
    if (r.status === "REFUNDED") {
      summary.refunded += 1;
      summary.totalRefundedYen += r.refundAmountYen;
    } else if (r.status === "NO_REFUND") {
      summary.noRefund += 1;
    } else if (r.status === "REFUND_FAILED") {
      summary.failed += 1;
    }
  }

  // フルページ取得 or 時間切れ → まだ残っている可能性あり。
  summary.hasMore = brokeEarly || targets.length === limit;
  return summary;
}
