import Link from "next/link";
import { GoalGenre } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { weeklyPageRanking, streakRanking, currentWeekStartYmd, RankRow } from "@/lib/ranking";
import { SUBJECTS, SUBJECT_LABELS, parseSubject } from "@/lib/subjects";

export const dynamic = "force-dynamic";

const profilePath = (name: string) => `/u/${encodeURIComponent(name)}`;
const initialOf = (name: string) => name.trim().charAt(0) || "S";
const MEDALS = ["🥇", "🥈", "🥉"];

// 参考書進捗ランキング（ログイン不要）。
//  metric=pages（今週の進捗ページ数）/ streak（連続報告日数）を ?metric= で切替。
//  ?subject=ENGLISH 等で科目フィルタ。
export default async function RankingPage({
  searchParams,
}: {
  searchParams: { metric?: string; subject?: string };
}) {
  const viewer = await getCurrentUser();
  const metric = searchParams.metric === "streak" ? "streak" : "pages";
  const subject = parseSubject(searchParams.subject);

  const rows: RankRow[] =
    metric === "streak"
      ? await streakRanking(subject as GoalGenre | null)
      : await weeklyPageRanking(subject as GoalGenre | null);

  const unit = metric === "streak" ? "日連続" : "ページ";
  const myRank = viewer ? rows.findIndex((r) => r.userId === viewer.id) : -1;

  // 現在の絞り込みを維持したままリンクを作るヘルパー。
  const linkTo = (next: { metric?: string; subject?: string | null }) => {
    const p = new URLSearchParams();
    const m = next.metric ?? metric;
    if (m !== "pages") p.set("metric", m);
    const s = next.subject === undefined ? subject : next.subject;
    if (s) p.set("subject", s);
    const qs = p.toString();
    return qs ? `/ranking?${qs}` : "/ranking";
  };

  const weekStart = currentWeekStartYmd();
  const weekLabel = `${Number(weekStart.slice(5, 7))}/${Number(weekStart.slice(8, 10))} 週`;

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>ランキング</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        参考書の進捗で競い合おう。{metric === "pages" ? `今週（${weekLabel}〜）の進捗ページ数` : "連続報告日数"}で集計。
      </p>

      {/* ===== 指標タブ ===== */}
      <div className="rank-tabs">
        <Link href={linkTo({ metric: "pages" })} className={metric === "pages" ? "rank-tab on" : "rank-tab"}>
          📖 今週のページ数
        </Link>
        <Link href={linkTo({ metric: "streak" })} className={metric === "streak" ? "rank-tab on" : "rank-tab"}>
          🔥 連続報告日数
        </Link>
      </div>

      {/* ===== 科目フィルタ ===== */}
      <div className="rank-filters">
        <Link href={linkTo({ subject: null })} className={!subject ? "rank-chip on" : "rank-chip"}>
          すべて
        </Link>
        {SUBJECTS.map((s) => (
          <Link
            key={s.value}
            href={linkTo({ subject: s.value })}
            className={subject === s.value ? "rank-chip on" : "rank-chip"}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* ===== ランキング表 ===== */}
      {rows.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            まだデータがありません。
            {metric === "pages"
              ? "今週の進捗を報告して1位を狙おう。"
              : "毎日報告してストリークを伸ばそう。"}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {rows.map((r, i) => {
            const isMe = viewer && r.userId === viewer.id;
            return (
              <div key={r.userId} className={isMe ? "rank-row me" : "rank-row"}>
                <span className="rank-pos">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="feed-avatar rank-avatar">{initialOf(r.displayName)}</span>
                <span className="rank-name">
                  <Link href={profilePath(r.displayName)} style={{ fontWeight: 700 }}>
                    {r.displayName}
                  </Link>
                  {r.university && (
                    <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                      {r.university}
                    </span>
                  )}
                </span>
                <span className="rank-num">
                  {r.value}
                  <span className="rank-unit">{unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {viewer && myRank >= 0 && (
        <p className="sub">あなたは現在 {myRank + 1} 位です。</p>
      )}
      {viewer && myRank < 0 && rows.length > 0 && (
        <p className="sub">
          あなたはまだ圏外です。<Link href="/report">今日の進捗を報告する →</Link>
        </p>
      )}
      {!viewer && (
        <p className="sub">
          <Link href="/signup?mode=signup">無料で登録して参加する →</Link>
        </p>
      )}

      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 16 }}>
        {subject ? `科目「${SUBJECT_LABELS[subject]}」で絞り込み中・` : ""}上位{rows.length}名を表示しています。
      </p>
    </div>
  );
}
