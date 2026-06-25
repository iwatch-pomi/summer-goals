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
    case "setup_intent.succeeded": {
      const si = event.data.object as Stripe.SetupIntent;
      const appUserId = si.metadata?.appUserId;
      const paymentMethodId =
        typeof si.payment_method === "string"
          ? si.payment_method
          : si.payment_method?.id;
      if (appUserId && paymentMethodId) {
        await prisma.user.update({
          where: { id: appUserId },
          data: {
            defaultPaymentMethodId: paymentMethodId,
            cardRegistered: true,
          },
        });
      }
      break;
    }
    case "payment_intent.payment_failed": {
      // ペナルティ決済の失敗。再請求/通知のフックを置く場所。
      const pi = event.data.object as Stripe.PaymentIntent;
      const penaltyId = pi.metadata?.penaltyId;
      if (penaltyId) {
        console.warn(`[webhook] payment failed for penalty ${penaltyId}`);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
