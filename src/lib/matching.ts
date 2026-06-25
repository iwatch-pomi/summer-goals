import { GoalGenre, GoalStatus, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { jstTomorrowString, toDateOnly } from "./dates";

// ===========================================================================
// マッチングロジック（docs/DESIGN.md 「2-A. マッチングが成立する流れ」）
// ===========================================================================

/**
 * 指定した Goal について、同ジャンルで待機中の相手を探してペアを成立させる。
 * - 成立したら Match を作成し、両 Goal を ACTIVE に更新する。
 * - 相手がいなければ何もしない（MATCHING のまま待機）。
 *
 * 同時実行で同じ相手を取り合う競合は、トランザクション + Goal の
 * status 条件付き更新（updateMany の count チェック）で防ぐ。
 */
export async function tryMatchGoal(goalId: string) {
  return prisma.$transaction(async (tx) => {
    const goal = await tx.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.status !== GoalStatus.MATCHING) {
      return { matched: false as const, reason: "not-matching" };
    }

    // 同ジャンル・MATCHING・自分以外の最古の Goal を候補に取る。
    const candidate = await tx.goal.findFirst({
      where: {
        genre: goal.genre,
        status: GoalStatus.MATCHING,
        userId: { not: goal.userId },
        id: { not: goal.id },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) {
      return { matched: false as const, reason: "no-candidate" };
    }

    // 2件の Goal を MATCHING→ACTIVE に条件付きで更新。
    // 別トランザクションが先に取っていたら count<2 となり中断する。
    const updated = await tx.goal.updateMany({
      where: {
        id: { in: [goal.id, candidate.id] },
        status: GoalStatus.MATCHING,
      },
      data: { status: GoalStatus.ACTIVE },
    });

    if (updated.count !== 2) {
      throw new Prisma.PrismaClientKnownRequestError(
        "matching race conflict",
        { code: "P2034", clientVersion: Prisma.prismaVersion.client }
      );
    }

    const match = await tx.match.create({
      data: {
        genre: goal.genre,
        userAId: goal.userId,
        userBId: candidate.userId,
        goalAId: goal.id,
        goalBId: candidate.id,
        status: MatchStatus.ACTIVE,
        startedAt: toDateOnly(jstTomorrowString()),
      },
    });

    return { matched: true as const, match };
  });
}

/**
 * 取りこぼし回収バッチ。MATCHING の Goal を古い順に走査し、
 * 同ジャンル同士をできる限りペアにする。Cron から定期実行する。
 */
export async function runMatchingSweep() {
  const waiting = await prisma.goal.findMany({
    where: { status: GoalStatus.MATCHING },
    orderBy: { createdAt: "asc" },
    select: { id: true, genre: true },
  });

  const seen = new Set<string>();
  let pairs = 0;

  for (const g of waiting) {
    if (seen.has(g.id)) continue;
    try {
      const res = await tryMatchGoal(g.id);
      if (res.matched) {
        seen.add(res.match.goalAId);
        seen.add(res.match.goalBId);
        pairs += 1;
      }
    } catch {
      // 競合は無視して次へ（次回スイープで拾う）。
    }
  }

  return { pairs };
}

export type Genre = GoalGenre;
