import Link from "next/link";
import { redirect } from "next/navigation";
import { GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";
import { computeStreak, weekStatus, reportedDateSet, WEEKDAY_LABELS } from "@/lib/streak";

export const dynamic = "force-dynamic"; // ログインユーザーごとに描画

// マイページ（Strava風3カラム）。左=プロフィール+ストリーク / 中央=進捗フィード / 右=参考書・ランキング。
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <h1>ログインが必要です</h1>
        <Link href="/signup?mode=login" className="btn">
          ログイン / 新規登録
        </Link>
      </div>
    );
  }

  if (!user.profileComplete) {
    redirect("/onboarding");
  }

  const todayYmd = jstDateString();
  const today = toDateOnly(todayYmd);
  const profileUrl = `/u/${encodeURIComponent(user.displayName)}`;

  const pendingBanner = user.status === "PENDING_DELETION" &&
    user.deletionScheduledAt && (
      <div className="card" style={{ borderColor: "#fca5a5" }}>
        <span className="badge">退会手続き中</span>
        <p style={{ margin: "8px 0 0" }}>
          {new Date(user.deletionScheduledAt).toLocaleDateString("ja-JP")}{" "}
          に完全削除されます。<Link href="/account">取り消す</Link>
        </p>
      </div>
    );

  // 自分の報告（新しい順・全件）。フィード＋ストリーク算出に使う。
  const reports = (await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { reportDate: "desc" },
    select: { id: true, reportDate: true, textContent: true, pagesRead: true, photoUrl: true, studiedSeconds: true },
  })) as Array<{
    id: string;
    reportDate: Date;
    textContent: string;
    pagesRead: number | null;
    photoUrl: string | null;
    studiedSeconds: number | null;
  }>;

  const signedUrls = await Promise.all(
    reports.map((r) => (r.photoUrl ? createSignedReportUrl(r.photoUrl) : Promise.resolve(null)))
  );

  const reportedSet = reportedDateSet(reports.map((r) => r.reportDate));
  const reportedToday = reportedSet.has(todayYmd);
  const currentStreak = computeStreak(reportedSet, today, reportedToday);
  const week = weekStatus(reportedSet, today);
  const successDays = reportedSet.size;

  // 進行中の宣言（最新の ACTIVE 目標）。今日が期間内かで報告可否を判定。
  const goals = await prisma.goal.findMany({
    where: { userId: user.id, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, periodStart: true, periodEnd: true },
  });
  const activeGoal = goals[0];
  const inPeriod = activeGoal
    ? today >= activeGoal.periodStart && today <= activeGoal.periodEnd
    : false;

  // もらった応援（自分の宣言・進捗への Cheer の合計）。
  const cheersReceived = await prisma.cheer.count({
    where: {
      OR: [{ goal: { userId: user.id } }, { report: { userId: user.id } }],
    },
  });

  const initial = user.displayName.trim().charAt(0) || "S";

  return (
    <div className="dash">
      <div className="dash-inner">
        {pendingBanner}
        <div className="dash-grid">
          {/* ===== 左：プロフィール＋ストリーク ===== */}
          <aside className="dash-left">
            <div className="card profile-card">
              <div className="profile-avatar">{initial}</div>
              <h2 style={{ margin: "10px 0 2px", fontSize: "1.2rem" }}>{user.displayName}</h2>
              {user.university && <p className="muted" style={{ margin: 0 }}>{user.university}</p>}

              <div className="profile-stats">
                <div>
                  <span className="stat-num">{successDays}</span>
                  <span className="stat-label">報告日数</span>
                </div>
                <div>
                  <span className="stat-num">{currentStreak}</span>
                  <span className="stat-label">連続日数</span>
                </div>
                <div>
                  <span className="stat-num">{cheersReceived}</span>
                  <span className="stat-label">もらった応援</span>
                </div>
              </div>

              <Link
                href={profileUrl}
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
              >
                公開プロフィールを見る
              </Link>
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.5rem" }}>🔥</span>
                <strong>{currentStreak}日 連続報告</strong>
              </div>
              <div className="streak-week">
                {week.map((done, i) => (
                  <div key={i} className="streak-day">
                    <span className={done ? "streak-dot on" : "streak-dot"}>
                      {done ? "✓" : ""}
                    </span>
                    <span className="streak-wd">{WEEKDAY_LABELS[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="sub" style={{ marginTop: 4 }}>
              <Link href="/account" className="muted">アカウント設定・退会</Link>
            </p>
          </aside>

          {/* ===== 中央：進捗フィード ===== */}
          <main className="dash-center">
            {activeGoal && !reportedToday && inPeriod && (
              <Link href="/report" className="btn" style={{ marginTop: 0 }}>
                今日の進捗を報告する
              </Link>
            )}
            {activeGoal && reportedToday && (
              <div className="card" style={{ marginTop: 0 }}>
                <strong>✅ 本日は報告済みです</strong>
              </div>
            )}
            {!activeGoal && (
              <div className="card" style={{ marginTop: 0 }}>
                <strong>まず参考書を登録しましょう</strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  取り組む参考書を登録すると、進捗を報告してランキングに参加できます。
                </p>
                <Link href="/goals/new" className="btn" style={{ marginTop: 12 }}>
                  参考書を登録する
                </Link>
              </div>
            )}
            {activeGoal && !inPeriod && (
              <div className="card" style={{ marginTop: 0 }}>
                <p className="muted" style={{ margin: 0 }}>登録した期間に入ると報告できます。</p>
              </div>
            )}

            {reports.length === 0 ? (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>まだ記録がありません。今日から始めましょう。</p>
              </div>
            ) : (
              reports.map((r, i) => (
                <div className="card feed-item" key={r.id}>
                  <div className="feed-head">
                    <div className="feed-avatar">{initial}</div>
                    <div>
                      <strong>{user.displayName}</strong>
                      <div className="muted" style={{ fontSize: "0.82rem" }}>
                        {r.reportDate.toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {r.pagesRead != null && (
                      <span className="badge">📖 {r.pagesRead}ページ</span>
                    )}
                    {r.studiedSeconds != null && (
                      <span className="badge">⏱ {Math.round(r.studiedSeconds / 60)}分 集中</span>
                    )}
                  </div>
                  {r.textContent ? (
                    <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{r.textContent}</p>
                  ) : (
                    !r.photoUrl &&
                    r.studiedSeconds == null &&
                    r.pagesRead == null && (
                      <p style={{ margin: "10px 0 0" }}>
                        <strong style={{ color: "var(--green)" }}>✅ 勉強した</strong>
                      </p>
                    )
                  )}
                  {signedUrls[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signedUrls[i] as string}
                      alt="進捗写真"
                      style={{
                        marginTop: 10,
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </main>

          {/* ===== 右：参考書 ＋ ランキング ＋ みんなの進捗 ===== */}
          <aside className="dash-right">
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>あなたの参考書</strong>
                <Link href="/goals/new" className="muted">追加 →</Link>
              </div>
              {goals.length === 0 ? (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                  まだ参考書がありません。
                </p>
              ) : (
                <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: "1.1em" }}>
                  {goals.map((g) => (
                    <li key={g.id}>{g.title}</li>
                  ))}
                </ul>
              )}
              <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.82rem" }}>
                共有リンク：<Link href={profileUrl}>{profileUrl}</Link>
              </p>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>ランキング</strong>
                <Link href="/ranking" className="muted">見る →</Link>
              </div>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                今週の進捗ページ数・連続報告日数でみんなと競おう。
              </p>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>みんなの進捗</strong>
                <Link href="/feed" className="muted">見る →</Link>
              </div>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                他の人の参考書と進捗を見て、応援しよう。
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
