// ===========================================================================
// 8月末・全ユーザーの部分返金を実行するバッチ（手動 / 単体実行スクリプト）
//
// 実行方法:
//   STRIPE_SECRET_KEY=sk_test_xxx DATABASE_URL=postgres://... npm run settle
//   （= tsx scripts/settle-refunds.ts）
//
// Vercel の Cron ルートと同じ精算ロジック（src/lib/settlement.ts）を再利用する。
// 違いは「時間制限なしで残りが無くなるまで全ページ処理する」点。
// → 月末に1回これを実行すれば、Hobby 枠でも全件をその場で精算できる。
//
// 返金額 = min(報告成功日数 × 100, デポジット上限 3000)。JPY は円そのまま。
// idempotencyKey により再実行しても二重返金されない。
// ===========================================================================

import { runSettlement } from "../src/lib/settlement";
import { prisma } from "../src/lib/prisma";

const PAGE_SIZE = Number(process.env.SETTLEMENT_PAGE_SIZE ?? 50);

async function main() {
  const now = new Date();
  const total = {
    evaluated: 0,
    refunded: 0,
    noRefund: 0,
    failed: 0,
    totalRefundedYen: 0,
  };

  let page = 0;
  // 残りが無くなるまで全ページ処理（手動実行なので時間制限なし）。
  for (;;) {
    const s = await runSettlement(now, { limit: PAGE_SIZE });
    page += 1;
    total.evaluated += s.evaluated;
    total.refunded += s.refunded;
    total.noRefund += s.noRefund;
    total.failed += s.failed;
    total.totalRefundedYen += s.totalRefundedYen;

    console.log(
      `page ${page}: 評価 ${s.evaluated} / 返金 ${s.refunded} / 返金0 ${s.noRefund} / 失敗 ${s.failed} / ¥${s.totalRefundedYen}`
    );

    if (!s.hasMore) break;
  }

  console.log("──────────────────────────────");
  console.log(
    `完了: 評価 ${total.evaluated} 件 / 返金 ${total.refunded} 件 / 返金額合計 ¥${total.totalRefundedYen} / 失敗 ${total.failed} 件`
  );
  if (total.failed > 0) {
    console.warn(
      "⚠️ 失敗あり（settlementStatus=REFUND_FAILED）。Stripe の状態を確認し、原因解消後に再実行してください。"
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
