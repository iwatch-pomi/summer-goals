import Link from "next/link";

// ランディング。コンセプトと CTA を表示する。
export default function HomePage() {
  return (
    <div>
      <span className="badge">夏休み限定 8月〜9月</span>
      <h1>ガチで目標、達成しよう。</h1>
      <p className="muted">
        同じ目標を持つ大学生と<strong>匿名でペア</strong>を組み、毎日進捗を報告。
        最初に<strong>¥3,500</strong>を預け、毎日続けるほど返ってくる。
        サボった日は<strong>1日¥100</strong>が失効。逃げ道を断って、本気を出そう。
      </p>

      <div className="card">
        <strong>仕組み</strong>
        <ol className="muted">
          <li>¥3,500を前払い（参加費¥500＋デポジット¥3,000）</li>
          <li>目標ジャンルを選んで相方とマッチング</li>
          <li>毎日23:59までにテキスト＋写真で報告</li>
          <li>月末に「報告した日数×¥100」をデポジットから返金</li>
        </ol>
      </div>

      <Link href="/signup" className="btn">
        はじめる
      </Link>
      <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
        すでに登録済みの方は <Link href="/dashboard">ダッシュボードへ</Link>
      </p>
    </div>
  );
}
