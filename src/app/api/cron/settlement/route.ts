import { NextRequest, NextResponse } from "next/server";
import { runSettlement } from "@/lib/settlement";
import { isAuthorizedCron } from "@/lib/cron";

export const runtime = "nodejs";
// Vercel Hobby（無料枠）の関数実行上限は 60 秒。これを超えない設定にする。
export const maxDuration = 60;

// GET /api/cron/settlement
// フロー3: 8月末の部分返金バッチ。Vercel Cron から起動（CRON_SECRET で保護）。
//
// ★Hobby 対策: 1回の実行は「最大 SETTLEMENT_PAGE_SIZE 件 ＋ 約50秒」で打ち切る。
//   残りは settlementStatus=PENDING のまま残り、翌日の Cron が続きから自動処理する
//   （Cron は毎日 00:10 JST に走るため、参加者が多くても数日で全件完了する）。
//   今すぐ全件処理したい場合は `npm run settle`（時間無制限）を使う。
//
// 手動検証時は ?now=YYYY-MM-DD で基準日を指定可能。
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowParam = req.nextUrl.searchParams.get("now");
  const now = nowParam ? new Date(`${nowParam}T23:59:59.000Z`) : new Date();

  const pageSize = Number(process.env.SETTLEMENT_PAGE_SIZE ?? 40);
  // 60秒上限に対し、Stripe 呼び出しのバラつきを考慮して約50秒で打ち切る。
  const summary = await runSettlement(now, {
    limit: pageSize,
    timeBudgetMs: 50_000,
  });

  return NextResponse.json({ ok: true, summary });
}
