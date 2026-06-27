import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Webhook は生のボディが必要なため Node ランタイムを使う。
export const runtime = "nodejs";

// POST /api/stripe/webhook
// Stripe からのイベントを受け取り、カード保存完了などを反映する。
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 冪等性: 同じ event を二重処理しない。
  try {
    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      // フロー2: ¥3,500 の前払い成功 → 有料会員（アクティブ）化。
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "enrollment" && pi.metadata?.challengeId) {
        // 返金で使う Charge ID を保持（latest_charge）。
        const chargeId =
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : pi.latest_charge?.id ?? null;

        await prisma.challenge.update({
          where: { id: pi.metadata.challengeId },
          data: {
            paymentStatus: "PAID",
            status: "ACTIVE",
            stripeChargeId: chargeId,
            paidAt: new Date(),
          },
        });
        if (pi.metadata.userId) {
          await prisma.user.update({
            where: { id: pi.metadata.userId },
            data: { paidMember: true }, // ★有料会員アクティブ
          });
        }
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "enrollment" && pi.metadata?.challengeId) {
        await prisma.challenge.update({
          where: { id: pi.metadata.challengeId },
          data: { paymentStatus: "FAILED" },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
