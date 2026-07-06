import { NextRequest, NextResponse } from "next/server";
import { GoalGenre, GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toDateOnly } from "@/lib/dates";

// POST /api/goals
// 個人の目標（ソロ）を作成する。マッチングや部屋作成には連動しない。
// ¥3,500 未決済（未参加）ユーザーは作成不可（強制力の前提）。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.paidMember) {
    return NextResponse.json(
      { error: "payment-required", message: "先に参加費（¥3,500）のお支払いが必要です" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const genreRaw = body?.genre as string | undefined;
  // ジャンルは任意タグ。送られた場合のみ enum 検証、無ければ null。
  const genre =
    genreRaw && Object.values(GoalGenre).includes(genreRaw as GoalGenre)
      ? (genreRaw as GoalGenre)
      : null;
  const title = (body?.title as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim() || null;
  const periodStart = body?.periodStart as string | undefined; // YYYY-MM-DD
  const periodEnd = body?.periodEnd as string | undefined;

  if (!title || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // ジャンル指定時のみ「1ユーザー1ジャンル同時1件」に制限（未指定は複数可）。
  if (genre) {
    const dup = await prisma.goal.findFirst({
      where: { userId: user.id, genre, status: GoalStatus.ACTIVE },
    });
    if (dup) {
      return NextResponse.json(
        { error: "duplicate-genre", message: "同じジャンルの目標がすでにあります" },
        { status: 409 }
      );
    }
  }

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      genre,
      title,
      description,
      periodStart: toDateOnly(periodStart),
      periodEnd: toDateOnly(periodEnd),
      status: GoalStatus.ACTIVE,
    },
  });

  return NextResponse.json({ goal }, { status: 201 });
}

// GET /api/goals — 自分の目標一覧
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ goals });
}
