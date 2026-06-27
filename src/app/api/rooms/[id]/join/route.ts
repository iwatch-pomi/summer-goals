import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/rooms/[id]/join — 入室。有料会員のみ。定員チェック・二重入室防止。
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.paidMember) {
    return NextResponse.json(
      { error: "payment-required", message: "参加（¥3,500）後に入室できます" },
      { status: 403 }
    );
  }

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: { _count: { select: { members: true } } },
  });
  if (!room) {
    return NextResponse.json({ error: "room-not-found" }, { status: 404 });
  }
  if (room._count.members >= room.maxMembers) {
    return NextResponse.json(
      { error: "room-full", message: "この部屋は満員です" },
      { status: 409 }
    );
  }

  try {
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: user.id },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // 既に入室済み → 冪等にOK扱い。
      return NextResponse.json({ joined: true, already: true });
    }
    throw e;
  }

  return NextResponse.json({ joined: true });
}
