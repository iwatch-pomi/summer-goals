// 報告日の集合（YYYY-MM-DD, JST基準）からストリーク・今週の状況を算出する共通関数。
// dashboard と 共有プロフィールの両方で使う。

/** 報告日(Date配列)を YYYY-MM-DD の Set に変換する。 */
export function reportedDateSet(dates: Date[]): Set<string> {
  return new Set(dates.map((d) => d.toISOString().slice(0, 10)));
}

/** 今日(または未報告なら昨日)から遡って連続で報告している日数。 */
export function computeStreak(
  reported: Set<string>,
  today: Date,
  reportedToday: boolean
): number {
  let streak = 0;
  const cursor = new Date(today);
  if (!reportedToday) cursor.setUTCDate(cursor.getUTCDate() - 1); // 今日未報告なら昨日から
  for (let i = 0; i < 400; i++) {
    const ymd = cursor.toISOString().slice(0, 10);
    if (reported.has(ymd)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** 今週(月〜日)の各曜日に報告があったか。 */
export function weekStatus(reported: Set<string>, today: Date): boolean[] {
  const dow = today.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  const out: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(reported.has(d.toISOString().slice(0, 10)));
  }
  return out;
}

export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
