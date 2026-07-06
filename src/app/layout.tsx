import type { Metadata, Viewport } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "SummerGoals — ガチ目標達成",
  description:
    "夏休み限定。同じ目標を持つ大学生と匿名でペアを組み、毎日の進捗報告でガチで達成する。",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: { capable: true, title: "SummerGoals", statusBarStyle: "default" },
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
        <SiteHeader />
        <main className="container">{children}</main>
        <SiteFooter />
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
