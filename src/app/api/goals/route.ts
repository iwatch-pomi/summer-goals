import { NextRequest, NextResponse } from "next/server";
import { GoalGenre, GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toDateOnly } from "@/lib/dates";

// POST /api/goals
// 目標を作成し、即時マッチングを試行する。
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
  const genre = body?.genre as GoalGenre | undefined;
  const title = (body?.title as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim() || null;
  const periodStart = body?.periodStart as string | undefined; // YYYY-MM-DD
  const periodEnd = body?.periodEnd as string | undefined;

  if (!genre || !Object.values(GoalGenre).includes(genre) || !title || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // 1ユーザー1ジャンル同時1件（進行中）に制限。
  const dup = await prisma.goal.findFirst({
    where: { userId: user.id, genre, status: GoalStatus.ACTIVE },
  });
  if (dup) {
    return NextResponse.json(
      { error: "duplicate-genre", message: "同じジャンルの目標がすでにあります" },
      { status: 409 }
    );
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
