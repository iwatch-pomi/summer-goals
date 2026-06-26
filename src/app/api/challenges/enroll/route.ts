import { NextRequest, NextResponse } from "next/server";
import { ChallengeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  stripe,
  SYSTEM_FEE_YEN,
  DEPOSIT_YEN,
  TOTAL_CHARGE_YEN,
  DAILY_FORFEIT_YEN,
  CHALLENGE_DURATION_DAYS,
} from "@/lib/stripe";
import { toDateOnly } from "@/lib/dates";

export const runtime = "nodejs";

// POST /api/challenges/enroll
// フロー1: ¥3,500 を前払い（PaymentIntent 作成 → フロントで confirm → 即時 Capture）。
// 内訳: システム参加費 ¥500（返金不可）+ デポジット ¥3,000（日割返金可）。
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 多重課金防止: 決済待ち/進行中のチャレンジが既にあれば再利用 or 拒否。
  const existing = await prisma.challenge.findFirst({
    where: {
      userId: user.id,
      status: { in: [ChallengeStatus.AWAITING_PAYMENT, ChallengeStatus.ACTIVE] },
    },
  });
  if (existing && existing.status === ChallengeStatus.ACTIVE) {
    return NextResponse.json(
      { error: "already-active", message: "既に参加中のチャレンジがあります" },
      { status: 409 }
    );
  }

  // 期間（既定: 2026-08-01 〜 30日間）。body で上書き可。
  const body = await req.json().catch(() => null);
  const startYmd = (body?.startDate as string | undefined) ?? "2026-08-01";
  const endYmd =
    (body?.endDate as string | undefined) ?? addDays(startYmd, CHALLENGE_DURATION_DAYS - 1);

  // Stripe Customer を確保（setup/route.ts と同じロジック）。
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { appUserId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // AWAITING_PAYMENT の Challenge を作成（既存の待機分があれば再利用）。
  const challenge =
    existing ??
    (await prisma.challenge.create({
      data: {
        userId: user.id,
        startDate: toDateOnly(startYmd),
        endDate: toDateOnly(endYmd),
        durationDays: CHALLENGE_DURATION_DAYS,
        systemFeeYen: SYSTEM_FEE_YEN,
        depositYen: DEPOSIT_YEN,
        totalChargedYen: TOTAL_CHARGE_YEN,
        dailyForfeitYen: DAILY_FORFEIT_YEN,
        status: ChallengeStatus.AWAITING_PAYMENT,
      },
    }));

  // ¥3,500 の PaymentIntent（即時キャプチャ）。
  // ★オーソリ保留は約7日で失効し30日保持できないため必ず capture する。
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: TOTAL_CHARGE_YEN, // 3500（円そのまま）
      currency: "jpy",
      customer: customerId,
      capture_method: "automatic",
      automatic_payment_methods: { enabled: true },
      metadata: {
        challengeId: challenge.id,
        userId: user.id,
        kind: "enrollment",
      },
    },
    { idempotencyKey: `enroll_${challenge.id}` }
  );

  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return NextResponse.json({
    challengeId: challenge.id,
    clientSecret: paymentIntent.client_secret,
    amount: TOTAL_CHARGE_YEN,
  });
}

// YYYY-MM-DD に日数を加算して YYYY-MM-DD を返す。
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
