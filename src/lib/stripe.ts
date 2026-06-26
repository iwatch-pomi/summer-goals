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
export const CHALLENGE_DURATION_DAYS = Number(process.env.CHALLENGE_DURATION_DAYS ?? 30);
