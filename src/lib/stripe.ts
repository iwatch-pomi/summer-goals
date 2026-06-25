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

export const PENALTY_AMOUNT_JPY = Number(process.env.PENALTY_AMOUNT_JPY ?? 500);
