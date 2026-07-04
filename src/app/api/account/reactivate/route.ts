import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reactivateAccount } from "@/lib/account";

export const runtime = "nodejs";

// POST /api/account/reactivate — 退会の取り消し（猶予期間中）。
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await reactivateAccount(user.id);
  return NextResponse.json({ ok: true });
}
