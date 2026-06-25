import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/stripe/setup
// Stripe Customer を作成（未作成なら）し、カード保存用の SetupIntent を返す。
// フロントは返却された client_secret で Stripe.js のカードフォームを確定する。
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session", // 後日の自動課金（ペナルティ）で使うため
    metadata: { appUserId: user.id },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
