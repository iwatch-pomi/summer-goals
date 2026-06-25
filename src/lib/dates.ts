// JST(Asia/Tokyo) 基準の日付ユーティリティ。
// サーバーの実行タイムゾーンに依存せず「JSTでの日付」を一貫して扱う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 指定時刻（既定: 現在）の JST での暦日を YYYY-MM-DD で返す。 */
export function jstDateString(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return jst.toISOString().slice(0, 10);
}

/** YYYY-MM-DD を、その日の JST 00:00 を指す Date(UTC) に変換する。 */
export function toDateOnly(ymd: string): Date {
  // Prisma の @db.Date は時刻を無視するため UTC 00:00 で十分。
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** 「前日（JST）」の YYYY-MM-DD を返す。日次バッチが対象とする日。 */
export function jstYesterdayString(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  jst.setUTCDate(jst.getUTCDate() - 1);
  return jst.toISOString().slice(0, 10);
}

/** 翌日（JST）の YYYY-MM-DD を返す。マッチ成立時の startedAt に使う。 */
export function jstTomorrowString(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  jst.setUTCDate(jst.getUTCDate() + 1);
  return jst.toISOString().slice(0, 10);
}
