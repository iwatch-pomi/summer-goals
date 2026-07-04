import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/profile — オンボーディング等でユーザーネーム・大学名を設定。
// ユーザーネームは重複不可。設定できたら profileComplete=true にする。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const username = (body?.username as string | undefined)?.trim().slice(0, 30);
  const university =
    (body?.university as string | undefined)?.trim().slice(0, 60) || null;

  if (!username) {
    return NextResponse.json(
      { error: "invalid-input", message: "ユーザーネームを入力してください" },
      { status: 400 }
    );
  }

  // 自分以外が同名を使っていないか確認。
  const taken = await prisma.user.findFirst({
    where: { displayName: username, id: { not: user.id } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "username-taken", message: "このユーザーネームは既に使われています" },
      { status: 409 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: username, university, profileComplete: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "username-taken", message: "このユーザーネームは既に使われています" },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
