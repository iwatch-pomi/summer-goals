import { prisma } from "./prisma";

// 宣言(goal)/進捗(report) の応援数と、閲覧者が応援済みかをまとめて取得するヘルパー。
// タイムライン・プロフィールで N+1 を避けるためにまとめて引く。
export interface CheerMaps {
  count: (kind: "goal" | "report", id: string) => number;
  mine: (kind: "goal" | "report", id: string) => boolean;
}

export async function loadCheers(
  goalIds: string[],
  reportIds: string[],
  viewerId?: string | null
): Promise<CheerMaps> {
  const goalCount = new Map<string, number>();
  const reportCount = new Map<string, number>();
  const myGoals = new Set<string>();
  const myReports = new Set<string>();

  if (goalIds.length) {
    const rows = await prisma.cheer.groupBy({
      by: ["goalId"],
      where: { goalId: { in: goalIds } },
      _count: { _all: true },
    });
    for (const r of rows) if (r.goalId) goalCount.set(r.goalId, r._count._all);
  }
  if (reportIds.length) {
    const rows = await prisma.cheer.groupBy({
      by: ["reportId"],
      where: { reportId: { in: reportIds } },
      _count: { _all: true },
    });
    for (const r of rows) if (r.reportId) reportCount.set(r.reportId, r._count._all);
  }
  if (viewerId && (goalIds.length || reportIds.length)) {
    const mine = await prisma.cheer.findMany({
      where: {
        userId: viewerId,
        OR: [{ goalId: { in: goalIds } }, { reportId: { in: reportIds } }],
      },
      select: { goalId: true, reportId: true },
    });
    for (const c of mine) {
      if (c.goalId) myGoals.add(c.goalId);
      if (c.reportId) myReports.add(c.reportId);
    }
  }

  return {
    count: (kind, id) =>
      (kind === "goal" ? goalCount.get(id) : reportCount.get(id)) ?? 0,
    mine: (kind, id) => (kind === "goal" ? myGoals : myReports).has(id),
  };
}
