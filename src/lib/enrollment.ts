import { prisma } from "./prisma";

// チャレンジを「支払い済み・進行中」にし、ユーザーを有料会員にする。
// Webhook と「決済直後の確認API」の両方から呼ばれるため冪等にしてある:
// status=AWAITING_PAYMENT のときだけ ACTIVE に更新する（二重実行で巻き戻さない）。
export async function markChallengePaid(params: {
  challengeId: string;
  userId: string;
  chargeId: string | null;
}): Promise<boolean> {
  const res = await prisma.challenge.updateMany({
    where: { id: params.challengeId, status: "AWAITING_PAYMENT" },
    data: {
      paymentStatus: "PAID",
      status: "ACTIVE",
      stripeChargeId: params.chargeId,
      paidAt: new Date(),
    },
  });

  // 実際に今回アクティブ化した場合（または保険として）有料会員フラグを立てる。
  if (res.count > 0) {
    await prisma.user.update({
      where: { id: params.userId },
      data: { paidMember: true },
    });
    return true;
  }
  return false;
}
