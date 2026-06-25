/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA 用に Service Worker / manifest を public/ から配信する。
  // 本格的な PWA キャッシュ戦略が必要になったら next-pwa 等の導入を検討。
  async headers() {
    return [
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
