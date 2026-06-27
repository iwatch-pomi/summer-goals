import { NextRequest, NextResponse } from "next/server";
import { ChallengeStatus, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jstDateString, toDateOnly } from "@/lib/dates";

// POST /api/reports
// その日の進捗報告（テキスト + 写真URL）を保存する。1日1報告。
// 写真は別途 Supabase Storage にアップロード済みの URL を受け取る想定。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const matchId = body?.matchId as string | undefined;
  const textContent = (body?.textContent as string | undefined)?.trim();
  const photoUrl = (body?.photoUrl as string | undefined) || null;

  if (!matchId || !textContent) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // 自分が当事者である ACTIVE な Match か検証。
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      status: MatchStatus.ACTIVE,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });
  if (!match) {
    return NextResponse.json({ error: "match-not-found" }, { status: 404 });
  }

  const reportDate = toDateOnly(jstDateString()); // 今日(JST)

  // ★この報告が返金計算に反映されるよう、対象日が期間内の ACTIVE な Challenge を
  //   引き当てて challengeId を保存する（これが無いと成功日数=0 で全額失効してしまう）。
  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: user.id,
      status: ChallengeStatus.ACTIVE,
      startDate: { lte: reportDate },
      endDate: { gte: reportDate },
    },
    select: { id: true },
  });
  if (!challenge) {
    return NextResponse.json(
      {
        error: "no-active-challenge",
        message: "進行中のチャレンジがありません（参加期間外、または未参加です）",
      },
      { status: 403 }
    );
  }

  try {
    const report = await prisma.report.create({
      data: {
        matchId,
        userId: user.id,
        challengeId: challenge.id,
        reportDate,
        textContent,
        photoUrl,
      },
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "already-reported", message: "本日はすでに報告済みです" },
        { status: 409 }
      );
    }
    throw e;
  }
}
