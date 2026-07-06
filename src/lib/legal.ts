// 法務ページ（利用規約・プライバシー・特商法）のリンク先。
// 本体は summergoals.jp（メインアプリ）に1か所だけ置く＝単一の正。
// ドメインを変えたくなったら NEXT_PUBLIC_LEGAL_BASE_URL で差し替え可能。
const BASE = process.env.NEXT_PUBLIC_LEGAL_BASE_URL ?? "https://summergoals.jp";

export const LEGAL = {
  terms: `${BASE}/terms`,
  privacy: `${BASE}/privacy`,
  tokushoho: `${BASE}/tokushoho`,
};
