import { NextRequest, NextResponse } from "next/server";
import { runDailyPenalty } from "@/lib/penalty";
import { runMatchingSweep } from "@/lib/matching";

export const runtime = "nodejs";
// Stripe 課金まで行うため十分なタイムアウトを確保（Vercel の上限に合わせる）。
export const maxDuration = 60;

// GET /api/cron/daily-penalty
// Vercel Cron（毎日 00:10 JST = 15:10 UTC）から起動される日次バッチ。
// CRON_SECRET で保護する。手動検証時は ?date=YYYY-MM-DD で対象日を指定可能。
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateOverride = req.nextUrl.searchParams.get("date") ?? undefined;

  // 取りこぼしマッチングを先に回収してから、サボり判定を行う。
  const sweep = await runMatchingSweep();
  const penalty = await runDailyPenalty(dateOverride);

  return NextResponse.json({ ok: true, sweep, penalty });
}
