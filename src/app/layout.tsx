import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Summer Goals — ガチ目標達成マッチング",
  description:
    "夏休み限定。同じ目標を持つ大学生と匿名でペアを組み、毎日の進捗報告でガチで達成する。",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Summer Goals", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#14b8a6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="logo">
              Summer<span>Goals</span>
            </Link>
            <Link href="/signup" className="btn-pill">
              エントリー
            </Link>
          </div>
        </header>
        <main className="container">{children}</main>
        {/* PWA Service Worker 登録 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
