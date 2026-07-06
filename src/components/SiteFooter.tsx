import { LEGAL } from "@/lib/legal";

// 全ページ共通フッター。法務ページ（summergoals.jp の正式ページ）へリンクする。
// 外部ドメインなので新規タブ＋ rel="noopener noreferrer"。
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <nav className="site-footer-links">
        <a href={LEGAL.terms} target="_blank" rel="noopener noreferrer">
          利用規約
        </a>
        <a href={LEGAL.privacy} target="_blank" rel="noopener noreferrer">
          プライバシーポリシー
        </a>
        <a href={LEGAL.tokushoho} target="_blank" rel="noopener noreferrer">
          特定商取引法に基づく表記
        </a>
      </nav>
      <p className="site-footer-copy">© {year} SummerGoals</p>
    </footer>
  );
}
