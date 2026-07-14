import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/cheers  { goalId? , reportId? }（どちらか一方のみ）
// 応援（エール）のトグル。要ログイン。二重応援は @@unique で防止。
// 返り値: { cheered: boolean, count: number }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const goalId = (body?.goalId as string | undefined) || undefined;
  const reportId = (body?.reportId as string | undefined) || undefined;

  // goalId / reportId はどちらか一方のみ。
  if ((!goalId && !reportId) || (goalId && reportId)) {
    return NextResponse.json({ error: "invalid-target" }, { status: 400 });
  }

  // 対象の存在確認（宣言は公開のもののみ応援可）。
  if (goalId) {
    const g = await prisma.goal.findUnique({
      where: { id: goalId },
      select: { isPublic: true },
    });
    if (!g || !g.isPublic) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
  } else {
    const rep = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!rep) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
  }

  const targetWhere = goalId ? { goalId } : { reportId };

  // トグル：既にあれば取り消し、無ければ作成。
  const existing = await prisma.cheer.findFirst({
    where: { userId: user.id, ...targetWhere },
    select: { id: true },
  });

  let cheered: boolean;
  if (existing) {
    await prisma.cheer.delete({ where: { id: existing.id } });
    cheered = false;
  } else {
    try {
      await prisma.cheer.create({ data: { userId: user.id, ...targetWhere } });
      cheered = true;
    } catch (e) {
      // 競合で既に作成済みなら「応援済み」とみなす。
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        cheered = true;
      } else {
        throw e;
      }
    }
  }

  const count = await prisma.cheer.count({ where: targetWhere });
  return NextResponse.json({ cheered, count });
}
