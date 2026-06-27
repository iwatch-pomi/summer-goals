import { NextRequest, NextResponse } from "next/server";
import { GoalGenre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/rooms — 全部屋一覧（メンバー数・自分が参加中か）
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { id: true } },
    },
  });

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      genre: r.genre,
      memberCount: r._count.members,
      maxMembers: r.maxMembers,
      joined: r.members.length > 0,
    })),
  });
}

// POST /api/rooms — 部屋を作成（作成者は自動入室）。有料会員のみ。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.paidMember) {
    return NextResponse.json(
      { error: "payment-required", message: "参加（¥3,500）後に部屋を作成できます" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim() || null;
  const genreRaw = body?.genre as string | undefined;
  const genre =
    genreRaw && Object.values(GoalGenre).includes(genreRaw as GoalGenre)
      ? (genreRaw as GoalGenre)
      : null;

  if (!name) {
    return NextResponse.json({ error: "invalid-input", message: "部屋名を入力してください" }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      name,
      description,
      genre,
      createdById: user.id,
      members: { create: { userId: user.id } }, // 作成者を自動入室
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}
