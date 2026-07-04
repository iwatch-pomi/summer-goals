import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deactivateAccount } from "@/lib/account";

export const runtime = "nodejs";

// POST /api/account/deactivate — 退会申請（7日後に完全削除を予約）。
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scheduledAt = await deactivateAccount(user.id);
  return NextResponse.json({ ok: true, scheduledAt });
}
