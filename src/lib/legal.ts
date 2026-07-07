// 法務ページ（利用規約・プライバシー・特商法）のリンク先。
// 本体は既存の pr.summergoals.jp に作成済みのページを単一の正として使う。
// 本番ドメイン（例: summergoals.jp）へ移したら NEXT_PUBLIC_LEGAL_BASE_URL で差し替え可能。
const BASE = process.env.NEXT_PUBLIC_LEGAL_BASE_URL ?? "https://pr.summergoals.jp";

export const LEGAL = {
  terms: `${BASE}/terms`,
  privacy: `${BASE}/privacy`,
  tokushoho: `${BASE}/tokushoho`,
};
