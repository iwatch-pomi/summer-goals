import { NextRequest, NextResponse } from "next/server";
import { GoalGenre, GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tryMatchGoal } from "@/lib/matching";
import { toDateOnly } from "@/lib/dates";

// POST /api/goals
// 目標を作成し、即時マッチングを試行する。
// カード未登録ユーザーは作成不可（強制力の前提）。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.cardRegistered) {
    return NextResponse.json(
      { error: "card-required", message: "先にクレジットカードを登録してください" },
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

  // 1ユーザー1ジャンル同時1件（進行中・待機中）に制限。
  const dup = await prisma.goal.findFirst({
    where: {
      userId: user.id,
      genre,
      status: { in: [GoalStatus.MATCHING, GoalStatus.ACTIVE] },
    },
  });
  if (dup) {
    return NextResponse.json(
      { error: "duplicate-genre", message: "同じジャンルの目標がすでに進行中です" },
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
      status: GoalStatus.MATCHING,
    },
  });

  // 即時マッチング試行（相手がいればその場でペア成立）。
  let matched = false;
  try {
    const res = await tryMatchGoal(goal.id);
    matched = res.matched;
  } catch {
    // 競合時は MATCHING のまま。Cron スイープで拾う。
  }

  return NextResponse.json({ goal, matched }, { status: 201 });
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
