import { NextRequest, NextResponse } from "next/server";
import { ChallengeStatus, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createServiceClient, STORAGE_BUCKET } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";

// 画像アップロード（Buffer）と service role を使うため Node ランタイム。
export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

// POST /api/reports  （multipart/form-data: matchId, textContent, photo?）
// その日の進捗報告を保存する。1日1報告。写真は service role でサーバー側から
// 非公開バケットへアップロードし、保存するのは「ストレージ上のパス」。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid-form" }, { status: 400 });
  }
  const matchId = form.get("matchId") as string | null;
  const textContent = (form.get("textContent") as string | null)?.trim();
  const photo = form.get("photo");

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

  // 写真があれば service role で非公開バケットへアップロード。保存するのはパス。
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "invalid-file-type", message: "画像ファイルのみアップロードできます" },
        { status: 400 }
      );
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "file-too-large", message: "画像は5MBまでです" },
        { status: 400 }
      );
    }
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${challenge.id}/${user.id}/${jstDateString()}-${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await photo.arrayBuffer());

    const service = createServiceClient();
    const { error: upErr } = await service.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: photo.type, upsert: false });
    if (upErr) {
      return NextResponse.json(
        { error: "upload-failed", message: "写真のアップロードに失敗しました" },
        { status: 500 }
      );
    }
    photoPath = path;
  }

  try {
    const report = await prisma.report.create({
      data: {
        matchId,
        userId: user.id,
        challengeId: challenge.id,
        reportDate,
        textContent,
        photoUrl: photoPath, // 非公開バケット上のパス（表示時に署名URLを発行）
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
