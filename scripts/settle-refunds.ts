// ===========================================================================
// 8月末・全ユーザーの部分返金を実行するバッチ（単体実行スクリプト）
//
// 実行方法:
//   STRIPE_SECRET_KEY=sk_test_xxx DATABASE_URL=postgres://... \
//   npx tsx scripts/settle-refunds.ts
//
// 返金額 = min(報告成功日数 × 100, デポジット上限 3000)
// 失効額 = 3000 − 返金額（＝運営利益。参加費 ¥500 は別途確保）
// JPY はゼロ桁通貨のため amount は「円そのまま」。
// idempotencyKey により再実行しても二重返金されない。
// ===========================================================================

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});
const prisma = new PrismaClient();

async function main() {
  const today = new Date();

  const targets = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      settlementStatus: "PENDING",
      paymentStatus: "PAID",
      endDate: { lte: today },
    },
  });

  console.log(`対象チャレンジ: ${targets.length}件`);

  for (const c of targets) {
    // 報告成功日数（期間内の distinct な報告日）
    const days = await prisma.report.findMany({
      where: {
        challengeId: c.id,
        reportDate: { gte: c.startDate, lte: c.endDate },
      },
      distinct: ["reportDate"],
      select: { reportDate: true },
    });
    const successDays = days.length;

    // 返金額 = min(成功日数 × 100, デポジット上限 3000)
    const refundAmount = Math.min(successDays * c.dailyForfeitYen, c.depositYen);
    const forfeited = c.depositYen - refundAmount;

    try {
      let refundId: string | null = null;

      if (refundAmount > 0) {
        const refund = await stripe.refunds.create(
          {
            payment_intent: c.stripePaymentIntentId ?? undefined, // または charge: c.stripeChargeId
            amount: refundAmount, // JPY はゼロ桁 → 円そのまま
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
          settlementStatus: refundAmount > 0 ? "REFUNDED" : "NO_REFUND",
          status: "SETTLED",
          settledAt: new Date(),
        },
      });

      console.log(
        `✓ ${c.id}: ${successDays}日成功 → ¥${refundAmount} 返金 / ¥${forfeited} 失効`
      );
    } catch (err) {
      await prisma.challenge.update({
        where: { id: c.id },
        data: { settlementStatus: "REFUND_FAILED" },
      });
      console.error(
        `✗ ${c.id} 返金失敗:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
