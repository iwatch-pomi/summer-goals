import { NextResponse } from "next/server";
import { ChallengeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { markChallengePaid } from "@/lib/enrollment";

export const runtime = "nodejs";

// POST /api/challenges/confirm
// 決済完了直後にフロントから呼ぶ。Webhook の到着を待たずに、Stripe へ直接
// 照会して支払い成功を確認し、その場でチャレンジをアクティブ化する。
// （Webhook はバックアップとして残る。両方走っても markChallengePaid が冪等）
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 直近の「決済待ち」チャレンジ（PaymentIntent 発行済み）を探す。
  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: user.id,
      status: ChallengeStatus.AWAITING_PAYMENT,
      stripePaymentIntentId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  // 既にアクティブ化済み（Webhook が先に処理した等）なら何もしないでOK。
  if (!challenge) {
    return NextResponse.json({ activated: user.paidMember });
  }

  // Stripe 上の実際の決済状況を確認。
  const pi = await stripe.paymentIntents.retrieve(
    challenge.stripePaymentIntentId as string
  );
  if (pi.status !== "succeeded") {
    return NextResponse.json({ activated: false, status: pi.status });
  }

  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;

  await markChallengePaid({
    challengeId: challenge.id,
    userId: user.id,
    chargeId,
  });

  return NextResponse.json({ activated: true });
}
