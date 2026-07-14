// ランキング算出。
//  ①週間の進捗ページ数ランキング（今週=月曜起点、pagesRead の合計）
//  ②連続報告日数（ストリーク）ランキング
// いずれも公開（isPublic）な取り組みの報告のみを対象にする。

import { GoalGenre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jstDateString, toDateOnly } from "@/lib/dates";
import { reportedDateSet, computeStreak } from "@/lib/streak";

const TOP_N = 30; // 表示上限
const STREAK_LOOKBACK_DAYS = 90; // ストリーク算出でさかのぼる日数

export type RankRow = {
  userId: string;
  displayName: string;
  university: string | null;
  value: number; // ページ数 or 連続日数
};

/** 今週（月曜起点, JST）の開始日を YYYY-MM-DD で返す。 */
export function currentWeekStartYmd(today: Date = new Date()): string {
  const todayYmd = jstDateString(today);
  const d = toDateOnly(todayYmd); // UTC 00:00（JSTの暦日）
  const dow = d.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** 今週の進捗ページ数ランキング（多い順・上位 TOP_N）。科目で絞り込み可。 */
export async function weeklyPageRanking(subject?: GoalGenre | null): Promise<RankRow[]> {
  const weekStart = toDateOnly(currentWeekStartYmd());

  const grouped = await prisma.report.groupBy({
    by: ["userId"],
    where: {
      reportDate: { gte: weekStart },
      pagesRead: { not: null },
      goal: { isPublic: true, ...(subject ? { genre: subject } : {}) },
    },
    _sum: { pagesRead: true },
    orderBy: { _sum: { pagesRead: "desc" } },
    take: TOP_N,
  });

  const rows = grouped.filter((g) => (g._sum.pagesRead ?? 0) > 0);
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, displayName: true, university: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = byId.get(r.userId);
    return {
      userId: r.userId,
      displayName: u?.displayName ?? "（退会ユーザー）",
      university: u?.university ?? null,
      value: r._sum.pagesRead ?? 0,
    };
  });
}

/** 連続報告日数ランキング（多い順・上位 TOP_N）。科目で絞り込み可。 */
export async function streakRanking(subject?: GoalGenre | null): Promise<RankRow[]> {
  const todayYmd = jstDateString();
  const today = toDateOnly(todayYmd);
  const since = toDateOnly(todayYmd);
  since.setUTCDate(since.getUTCDate() - STREAK_LOOKBACK_DAYS);

  // 直近の公開報告を取得し、ユーザーごとに報告日を集める。
  const reports = await prisma.report.findMany({
    where: {
      reportDate: { gte: since },
      goal: { isPublic: true, ...(subject ? { genre: subject } : {}) },
    },
    select: {
      reportDate: true,
      user: { select: { id: true, displayName: true, university: true } },
    },
  });

  type Acc = { displayName: string; university: string | null; dates: Date[] };
  const byUser = new Map<string, Acc>();
  for (const r of reports) {
    const acc = byUser.get(r.user.id) ?? {
      displayName: r.user.displayName,
      university: r.user.university,
      dates: [],
    };
    acc.dates.push(r.reportDate);
    byUser.set(r.user.id, acc);
  }

  const rows: RankRow[] = [];
  for (const [userId, acc] of byUser) {
    const set = reportedDateSet(acc.dates);
    const streak = computeStreak(set, today, set.has(todayYmd));
    if (streak > 0) {
      rows.push({ userId, displayName: acc.displayName, university: acc.university, value: streak });
    }
  }

  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, TOP_N);
}
