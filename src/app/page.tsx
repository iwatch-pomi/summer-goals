import Link from "next/link";
import { GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const profilePath = (name: string) => `/u/${encodeURIComponent(name)}`;

// ランディング。目標を公言して、みんなの視線と応援で達成する（無料）。
export default async function HomePage() {
  // 最新の公開宣言を数件プレビュー（ログイン不要で中身が見える Amazon 型）。
  const recentGoals = (await prisma.goal.findMany({
    where: { isPublic: true, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, user: { select: { displayName: true } } },
  }).catch(() => [])) as Array<{ id: string; title: string; user: { displayName: string } }>;

  return (
    <div>
      <section className="hero">
        <span className="badge">完全無料</span>

        <h2 className="headline">
          目標を<span className="accent">公言</span>して、
          <br />
          最後までやり切る。
        </h2>

        <p className="lead">
          一人だと続かない目標も、<strong>みんなに宣言</strong>すれば変わる。
          毎日の進捗を公開し、応援をもらいながら達成する——お金はかかりません。
        </p>

        <Link href="/signup?mode=signup" className="btn btn-lg" style={{ marginTop: 18 }}>
          無料で宣言をはじめる →
        </Link>
        <p className="sub">
          すでに登録済みの方は <Link href="/signup?mode=login">ログイン</Link>
        </p>
        <p className="sub" style={{ marginTop: 4 }}>
          <Link href="/feed">みんなの宣言をのぞいてみる →</Link>
        </p>

        <div className="stats">
          <div className="stat">
            <span className="stat-num">¥0</span>
            <span className="stat-label">完全無料</span>
          </div>
          <div className="stat">
            <span className="stat-num">公開</span>
            <span className="stat-label">宣言効果</span>
          </div>
          <div className="stat">
            <span className="stat-num">応援</span>
            <span className="stat-label">みんなで</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <span className="eyebrow">The Pain</span>
        <h3>「今年こそ」が、毎年溶けていく。</h3>
        <p className="muted">
          やる気はある。でも一人だと続かない。意志の力だけに頼るのは、もうやめよう。
          <strong>人に宣言すると、人は動く。</strong>
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <span className="eyebrow">How it works</span>
        <h3>仕組み</h3>
        <div className="card">
          <ol className="muted">
            <li>目標を<strong>宣言</strong>する（公開プロフィールに載る）</li>
            <li>毎日、進捗を報告（写真・ボタン・タイマーから選べる）</li>
            <li>みんなが見て<strong>応援</strong>してくれる → 続けられる</li>
            <li>共有リンクを SNS に貼れば、宣言効果はさらに強力に</li>
          </ol>
          <p className="muted" style={{ margin: 0 }}>
            費用は一切かかりません。強制力は「お金」ではなく「みんなの視線と応援」です。
          </p>
        </div>
      </section>

      {recentGoals.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <span className="eyebrow">Now declaring</span>
          <h3>いま宣言している人たち</h3>
          {recentGoals.map((g) => (
            <div className="card" key={g.id} style={{ margin: "10px 0" }}>
              <Link href={profilePath(g.user.displayName)} style={{ fontWeight: 700 }}>
                {g.user.displayName}
              </Link>
              <p style={{ margin: "4px 0 0" }}>🎯 {g.title}</p>
            </div>
          ))}
          <p className="sub">
            <Link href="/feed">もっと見る →</Link>
          </p>
        </section>
      )}

      <section style={{ marginTop: 32 }} className="center">
        <Link href="/signup?mode=signup" className="btn btn-lg">
          無料で宣言をはじめる →
        </Link>
        <p className="sub">
          すでに登録済みの方は <Link href="/signup?mode=login">ログイン</Link>
        </p>
      </section>
    </div>
  );
}
