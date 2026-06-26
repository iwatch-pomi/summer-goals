import { NextRequest, NextResponse } from "next/server";
import { runSettlement } from "@/lib/settlement";

export const runtime = "nodejs";
// 全ユーザーへの返金を行うため十分なタイムアウトを確保。
export const maxDuration = 300;

// GET /api/cron/settlement
// フロー3: 8月末の部分返金バッチ。Vercel Cron から起動（CRON_SECRET で保護）。
// 手動検証時は ?now=YYYY-MM-DD で基準日を指定可能。
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowParam = req.nextUrl.searchParams.get("now");
  const now = nowParam ? new Date(`${nowParam}T23:59:59.000Z`) : new Date();

  const summary = await runSettlement(now);
  return NextResponse.json({ ok: true, summary });
}
