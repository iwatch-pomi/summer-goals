import Link from "next/link";
import { weeklyPageRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

const profilePath = (name: string) => `/u/${encodeURIComponent(name)}`;
const MEDALS = ["🥇", "🥈", "🥉"];

// ランディング。参考書の進捗を報告して、みんなと競い合う（無料）。
export default async function HomePage() {
  // 今週の進捗ページ数ランキング上位をプレビュー（ログイン不要で中身が見える）。
  const topRanking = await weeklyPageRanking().catch(() => []);
  const preview = topRanking.slice(0, 5);

  return (
    <div>
      <section className="hero">
        <span className="badge">完全無料</span>

        <h2 className="headline">
          参考書の進捗で、
          <br />
          <span className="accent">競い合う</span>。
        </h2>

        <p className="lead">
          今日は何ページ進んだ？ 参考書・教科書の進捗を報告して、
          <strong>全国の受験生・資格勢とランキングで競争</strong>。
          仲間の頑張りが、あなたの毎日を動かす——お金はかかりません。
        </p>

        <Link href="/signup?mode=signup" className="btn btn-lg" style={{ marginTop: 18 }}>
          無料で始める →
        </Link>
        <p className="sub">
          すでに登録済みの方は <Link href="/signup?mode=login">ログイン</Link>
        </p>
        <p className="sub" style={{ marginTop: 4 }}>
          <Link href="/ranking">今週のランキングを見る →</Link>
        </p>

        <div className="stats">
          <div className="stat">
            <span className="stat-num">¥0</span>
            <span className="stat-label">完全無料</span>
          </div>
          <div className="stat">
            <span className="stat-num">📖</span>
            <span className="stat-label">ページで記録</span>
          </div>
          <div className="stat">
            <span className="stat-num">🏆</span>
            <span className="stat-label">ランキング</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <span className="eyebrow">The Pain</span>
        <h3>参考書、いつも途中で止まってない？</h3>
        <p className="muted">
          やる気はある。でも一人だと続かない。
          <strong>みんなが頑張っているのが見えると、人は動く。</strong>
          進捗を競い合えば、参考書は最後までやり切れる。
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <span className="eyebrow">How it works</span>
        <h3>仕組み</h3>
        <div className="card">
          <ol className="muted">
            <li>取り組む<strong>参考書・教科書</strong>を登録する</li>
            <li>毎日、進めた<strong>ページ数</strong>を報告する</li>
            <li><strong>週間ランキング・連続日数</strong>でみんなと競い合う</li>
            <li>気になる人を<strong>応援</strong>して、一緒に伸びる</li>
          </ol>
          <p className="muted" style={{ margin: 0 }}>
            費用は一切かかりません。受験生も、TOEIC・資格・専門科目に取り組む大学生も。
          </p>
        </div>
      </section>

      {preview.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <span className="eyebrow">This week</span>
          <h3>今週のランキング</h3>
          <div className="card" style={{ padding: 8 }}>
            {preview.map((r, i) => (
              <div className="rank-row" key={r.userId}>
                <span className="rank-pos">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="rank-name">
                  <Link href={profilePath(r.displayName)} style={{ fontWeight: 700 }}>
                    {r.displayName}
                  </Link>
                </span>
                <span className="rank-num">
                  {r.value}
                  <span className="rank-unit">ページ</span>
                </span>
              </div>
            ))}
          </div>
          <p className="sub">
            <Link href="/ranking">ランキングをすべて見る →</Link>
          </p>
        </section>
      )}

      <section style={{ marginTop: 32 }} className="center">
        <Link href="/signup?mode=signup" className="btn btn-lg">
          無料で始める →
        </Link>
        <p className="sub">
          すでに登録済みの方は <Link href="/signup?mode=login">ログイン</Link>
        </p>
      </section>
    </div>
  );
}
