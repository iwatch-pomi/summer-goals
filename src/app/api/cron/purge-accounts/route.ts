import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredAccounts } from "@/lib/account";
import { isAuthorizedCron } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/purge-accounts
// 退会申請から7日を過ぎたユーザーを完全削除する日次バッチ（CRON_SECRET で保護）。
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await purgeExpiredAccounts();
  return NextResponse.json({ ok: true, summary });
}
