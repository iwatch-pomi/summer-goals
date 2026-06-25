import {
  GiftStatus,
  MatchStatus,
  PenaltyStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import { stripe, PENALTY_AMOUNT_JPY } from "./stripe";
import { issueGift } from "./gift";
import { jstYesterdayString, toDateOnly } from "./dates";

// ===========================================================================
// 日次バッチ: サボり判定 → Stripe 決済 → ギフト付与
// docs/DESIGN.md 「2-B. 23:59 サボり判定〜Stripe 決済処理の流れ」
// 毎日 00:10 JST に Vercel Cron から起動し「前日 D」を判定する。
// ===========================================================================

export interface DailyPenaltyResult {
  targetDate: string;
  matchesEvaluated: number;
  penaltiesCreated: number;
  charged: number;
  chargeFailed: number;
  giftsIssued: number;
  matchesEnded: number;
}

/**
 * @param dateOverride 判定対象日(YYYY-MM-DD)。未指定なら「前日(JST)」。
 */
export async function runDailyPenalty(
  dateOverride?: string
): Promise<DailyPenaltyResult> {
  const targetYmd = dateOverride ?? jstYesterdayString();
  const targetDate = toDateOnly(targetYmd);

  const result: DailyPenaltyResult = {
    targetDate: targetYmd,
    matchesEvaluated: 0,
    penaltiesCreated: 0,
    charged: 0,
    chargeFailed: 0,
    giftsIssued: 0,
    matchesEnded: 0,
  };

  // 1. 対象日が期間内の ACTIVE な Match を取得。
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.ACTIVE,
      startedAt: { lte: targetDate },
    },
    include: {
      reports: { where: { reportDate: targetDate } },
      goalA: { select: { periodEnd: true } },
      goalB: { select: { periodEnd: true } },
      userA: { select: { id: true, email: true, defaultPaymentMethodId: true, stripeCustomerId: true } },
      userB: { select: { id: true, email: true, defaultPaymentMethodId: true, stripeCustomerId: true } },
    },
  });

  for (const match of matches) {
    result.matchesEvaluated += 1;

    const aReported = match.reports.some((r) => r.userId === match.userAId);
    const bReported = match.reports.some((r) => r.userId === match.userBId);

    // 2-3. 判定分岐
    if (aReported && bReported) {
      // 両者報告済 → ペナルティなし
    } else if (!aReported && !bReported) {
      // 両者未報告 → 受領者不在のため MVP では課金しない
    } else {
      // 片方のみ未報告 → サボった側を from、達成側を to に
      const saboteur = aReported ? match.userB : match.userA;
      const winner = aReported ? match.userA : match.userB;

      // 冪等: (matchId, fromUserId, reportDate) でユニーク。既存ならスキップ。
      const penalty = await prisma.penalty
        .create({
          data: {
            matchId: match.id,
            reportDate: targetDate,
            fromUserId: saboteur.id,
            toUserId: winner.id,
            amount: PENALTY_AMOUNT_JPY,
            penaltyStatus: PenaltyStatus.PENDING,
            giftStatus: GiftStatus.NONE,
          },
        })
        .catch((e) => {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            return null; // 既に処理済み（バッチ再実行）
          }
          throw e;
        });

      if (!penalty) continue;
      result.penaltiesCreated += 1;

      // 4. Stripe で off_session 決済
      const charged = await chargePenalty(penalty.id, saboteur);
      if (charged) {
        result.charged += 1;
        // 5. ギフト付与トリガー
        const issued = await issuePenaltyGift(penalty.id, winner);
        if (issued) result.giftsIssued += 1;
      } else {
        result.chargeFailed += 1;
      }
    }

    // 7. 期間終了処理: 両目標の periodEnd を過ぎたら ENDED に。
    const periodEnd =
      match.goalA.periodEnd < match.goalB.periodEnd
        ? match.goalB.periodEnd
        : match.goalA.periodEnd;
    if (targetDate >= periodEnd) {
      await prisma.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ENDED, endedAt: targetDate },
      });
      result.matchesEnded += 1;
    }
  }

  return result;
}

/** PENDING の Penalty を Stripe で課金する。成功で true。 */
async function chargePenalty(
  penaltyId: string,
  saboteur: { id: string; stripeCustomerId: string | null; defaultPaymentMethodId: string | null }
): Promise<boolean> {
  if (!saboteur.stripeCustomerId || !saboteur.defaultPaymentMethodId) {
    await prisma.penalty.update({
      where: { id: penaltyId },
      data: { penaltyStatus: PenaltyStatus.CHARGE_FAILED },
    });
    return false;
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: PENALTY_AMOUNT_JPY,
        currency: "jpy",
        customer: saboteur.stripeCustomerId,
        payment_method: saboteur.defaultPaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { penaltyId },
      },
      // Stripe 側でも冪等性を担保（バッチ再実行で二重課金しない）
      { idempotencyKey: `penalty_${penaltyId}` }
    );

    await prisma.penalty.update({
      where: { id: penaltyId },
      data: {
        stripePaymentIntentId: intent.id,
        penaltyStatus: PenaltyStatus.CHARGED,
        giftStatus: GiftStatus.PENDING,
      },
    });
    return true;
  } catch (e) {
    await prisma.penalty.update({
      where: { id: penaltyId },
      data: { penaltyStatus: PenaltyStatus.CHARGE_FAILED },
    });
    console.error(`[penalty] charge failed for ${penaltyId}:`, e);
    return false;
  }
}

/** CHARGED の Penalty に対して相方へ eGift を発行する。成功で true。 */
async function issuePenaltyGift(
  penaltyId: string,
  winner: { id: string; email: string }
): Promise<boolean> {
  const res = await issueGift({
    toUserId: winner.id,
    toEmail: winner.email,
    amountJpy: PENALTY_AMOUNT_JPY,
  });

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: res.ok
      ? {
          giftStatus: GiftStatus.ISSUED,
          giftProvider: res.provider,
          giftCode: res.code,
        }
      : { giftStatus: GiftStatus.FAILED, giftProvider: res.provider },
  });
  return res.ok;
}
