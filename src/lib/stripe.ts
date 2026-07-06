import Stripe from "stripe";

// サーバー専用。STRIPE_SECRET_KEY は絶対にクライアントへ渡さない。
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // ビルド時に環境変数が無くても落ちないよう warning に留める。
  // 実行時にキーが無ければ Stripe 呼び出しで明確にエラーになる。
  console.warn("[stripe] STRIPE_SECRET_KEY が未設定です（.env.local を確認）");
}

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
  typescript: true,
});

// デポジット返金モデルの金額定数（JPY はゼロ桁通貨 = 円そのまま）。
export const SYSTEM_FEE_YEN = Number(process.env.SYSTEM_FEE_YEN ?? 500); // 返金不可
export const DEPOSIT_YEN = Number(process.env.DEPOSIT_YEN ?? 3000); // 日割返金可（返金上限）
export const TOTAL_CHARGE_YEN = SYSTEM_FEE_YEN + DEPOSIT_YEN; // 前払い総額 = 3500
export const DAILY_FORFEIT_YEN = Number(process.env.DAILY_FORFEIT_YEN ?? 100); // サボり1日の失効額
// 期間（日数）。テスト時は NEXT_PUBLIC_ 変数でも上書き可（クライアントと共通の1系統）。
export const CHALLENGE_DURATION_DAYS = Number(
  process.env.CHALLENGE_DURATION_DAYS ??
    process.env.NEXT_PUBLIC_CHALLENGE_DURATION_DAYS ??
    30
);

// 開始日の選択可能範囲（YYYY-MM-DD）。下限 8/12・上限 9/10（env で上書き可）。
// 実際の下限は max(この値, 今日JST)。過去日は不可（抜け穴防止）。
// テスト時に開始日を前倒ししたい場合は NEXT_PUBLIC_CHALLENGE_MIN_START_DATE を設定する
//（NEXT_PUBLIC_ はサーバーからも読めるため、クライアントの日付ピッカーと下限を一致させられる）。
export const CHALLENGE_MIN_START_DATE =
  process.env.CHALLENGE_MIN_START_DATE ??
  process.env.NEXT_PUBLIC_CHALLENGE_MIN_START_DATE ??
  "2026-08-12";
export const CHALLENGE_MAX_START_DATE =
  process.env.CHALLENGE_MAX_START_DATE ??
  process.env.NEXT_PUBLIC_CHALLENGE_MAX_START_DATE ??
  "2026-09-10";

// 猶予日数の既定値（スキーマ既定・フォールバック用）。
// 実際の返金計算はチャレンジごとの graceDays（開始30日間の土日数）を使う。
export const GRACE_DAYS = Number(process.env.GRACE_DAYS ?? 8);
