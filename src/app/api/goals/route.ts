import { NextRequest, NextResponse } from "next/server";
import { GoalGenre, GoalStatus, ReportMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toDateOnly } from "@/lib/dates";

const MAX_STUDY_MINUTES = 600; // タイマー規定時間の上限（10時間）

// POST /api/goals
// 目標（公開宣言）を作成する。ログインユーザーなら誰でも無料で作成可能。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // 総ページ数（任意）。1〜9999の整数のみ採用、それ以外は null。
  let totalPages: number | null = null;
  const totalPagesRaw = body?.totalPages;
  if (totalPagesRaw != null && String(totalPagesRaw).trim() !== "") {
    const n = Number(totalPagesRaw);
    if (Number.isInteger(n) && n >= 1 && n <= 9999) {
      totalPages = n;
    } else {
      return NextResponse.json(
        { error: "invalid-total-pages", message: "総ページ数は1〜9999の整数で入力してください" },
        { status: 400 }
      );
    }
  }

  // 報告方法。不正・未指定は PHOTO。
  const methodRaw = body?.reportMethod as string | undefined;
  const reportMethod =
    methodRaw && Object.values(ReportMethod).includes(methodRaw as ReportMethod)
      ? (methodRaw as ReportMethod)
      : ReportMethod.PHOTO;

  // TIMER のときだけ studyMinutes（正の整数・上限あり）を必須とする。
  let studyMinutes: number | null = null;
  if (reportMethod === ReportMethod.TIMER) {
    const raw = Number(body?.studyMinutes);
    if (!Number.isInteger(raw) || raw < 1 || raw > MAX_STUDY_MINUTES) {
      return NextResponse.json(
        {
          error: "invalid-study-minutes",
          message: `勉強時間は1〜${MAX_STUDY_MINUTES}分で指定してください`,
        },
        { status: 400 }
      );
    }
    studyMinutes = raw;
  }

  if (!title || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // 同じ科目で複数の参考書を並行できるよう、科目の重複制限は設けない。

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      genre,
      title,
      description,
      totalPages,
      reportMethod,
      studyMinutes,
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
