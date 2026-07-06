import { NextRequest, NextResponse } from "next/server";
import { ChallengeStatus, GoalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createServiceClient, STORAGE_BUCKET } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";

// 画像アップロード（Buffer）と service role を使うため Node ランタイム。
export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// POST /api/reports  （multipart/form-data: textContent, photo?）
// ソロの進捗報告。自分の進行中チャレンジ（Challenge）に紐づけて保存する。1日1報告。
// 写真は service role でサーバー側から非公開バケットへアップロードし、保存するのはパス。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid-form" }, { status: 400 });
  }
  const textContent = (form.get("textContent") as string | null)?.trim();
  const photo = form.get("photo");

  if (!textContent) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  // 目標必須ゲートのバックストップ：進行中の目標が無ければ報告不可。
  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: GoalStatus.ACTIVE },
    select: { id: true },
  });
  if (!goal) {
    return NextResponse.json(
      { error: "goal-required", message: "先に目標を作成してください" },
      { status: 400 }
    );
  }

  const reportDate = toDateOnly(jstDateString()); // 今日(JST)

  // 対象日が期間内の ACTIVE な Challenge を引き当てる（無ければ報告不可）。
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
    // ラスター画像のみ許可（SVG はスクリプトを含みうるため除外）。
    if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
      return NextResponse.json(
        { error: "invalid-file-type", message: "画像（JPEG/PNG/WebP/GIF）のみアップロードできます" },
        { status: 400 }
      );
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "file-too-large", message: "画像は5MBまでです" },
        { status: 400 }
      );
    }
    // 拡張子はファイル名（クライアント任意）由来なので英数字のみに正規化する。
    // これをしないと "a.png/../../x" のようなパストラバーサルを許してしまう。
    const ext = EXT_BY_TYPE[photo.type] ?? "jpg";
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
        userId: user.id,
        challengeId: challenge.id,
        reportDate,
        textContent,
        photoUrl: photoPath,
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
