/** @type {import('next').NextConfig} */

// 全ルートに付与するセキュリティヘッダー。
// - クリックジャッキング防止（決済画面を iframe に埋め込ませない）
// - HTTPS 強制（HSTS）・MIME スニッフィング防止・リファラ最小化
// - 不要なブラウザ機能（カメラ/マイク/位置/決済API）を既定で無効化
// ※ CSP は Stripe.js 等の許可設定が必要で誤設定リスクが高いため、
//   本番で十分に検証してから別途追加する想定（ここでは入れない）。
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // PWA 用に Service Worker / manifest を public/ から配信する。
  // 本格的な PWA キャッシュ戦略が必要になったら next-pwa 等の導入を検討。
  async headers() {
    return [
      {
        // 全ページ・全APIにセキュリティヘッダーを付与。
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
