import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/username-available?name=... → { available: boolean }
// ユーザーネーム（displayName）の空き確認。
export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  if (!name) {
    return NextResponse.json({ available: false });
  }
  const existing = await prisma.user.findFirst({
    where: { displayName: name },
    select: { id: true },
  });
  return NextResponse.json({ available: !existing });
}
