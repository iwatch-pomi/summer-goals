// 最小限の Service Worker（PWA インストール要件を満たすため）。
// MVP では高度なキャッシュ戦略は持たず、まずインストール可能にすることを優先。
// 必要に応じて next-pwa / Workbox でオフライン対応を強化する。

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // ネットワーク優先（パススルー）。オフラインキャッシュは今後の課題。
});
