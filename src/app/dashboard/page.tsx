import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallengeStatus, GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic"; // ログインユーザーごとに描画

// マイページ（Strava風3カラム）。左=プロフィール+ストリーク / 中央=記録フィード / 右=部屋。
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

  // ---- 未払い: 参加導線中心のシンプル表示 ----
  if (!user.paidMember) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h1 style={{ margin: 0 }}>こんにちは、{user.displayName} さん</h1>
          <LogoutButton />
        </div>
        {pendingBanner}
        <div className="card">
          <span className="badge">未参加</span>
          <h3 style={{ margin: "6px 0" }}>チャレンジに参加する</h3>
          <p className="muted">
            参加費 ¥500（返金不可）＋ デポジット ¥3,000（報告した日数に応じて返金）。
            いつでも参加できます。
          </p>
          <Link href="/enroll" className="btn">
            ¥3,500 を支払って参加する
          </Link>
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>部屋</strong>
            <Link href="/rooms" className="muted">部屋をさがす →</Link>
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            参加前でも、みんなの部屋の一覧は見られます。
          </p>
        </div>
        <p className="sub" style={{ marginTop: 20 }}>
          <Link href="/account" className="muted">アカウント設定・退会</Link>
        </p>
      </div>
    );
  }

  // ---- 有料: データ取得 ----
  const challenge = await prisma.challenge.findFirst({
    where: { userId: user.id, status: ChallengeStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });

  // 自分の報告（新しい順・全件）。フィード＋ストリーク算出に使う。
  const reports = (await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { reportDate: "desc" },
  })) as Array<{
    id: string;
    reportDate: Date;
    textContent: string;
    photoUrl: string | null;
    studiedSeconds: number | null;
  }>;

  // 写真の署名URLをまとめて発行。
  const signedUrls = await Promise.all(
    reports.map((r) => (r.photoUrl ? createSignedReportUrl(r.photoUrl) : Promise.resolve(null)))
  );

  // 報告日の集合（YYYY-MM-DD, JST基準の日付文字列）。
  const reportedSet = new Set(
    reports.map((r) => r.reportDate.toISOString().slice(0, 10))
  );
  const reportedToday = reportedSet.has(todayYmd);

  // 連続報告日数（今日 or 昨日から遡って連続）。
  const currentStreak = computeStreak(reportedSet, today, reportedToday);

  // 今週（月〜日）の報告状況。
  const week = weekStatus(reportedSet, today);

  // 返金見込み・残り日数・成功日数。
  let successDays = 0;
  let refundEstimateYen = 0;
  let daysRemaining = 0;
  let inPeriod = false;
  const graceDays = challenge?.graceDays ?? 0; // 表示用（このチャレンジの土日数）
  if (challenge) {
    const distinct = new Set(
      reports
        .filter((r) => r.reportDate >= challenge.startDate && r.reportDate <= challenge.endDate)
        .map((r) => r.reportDate.toISOString().slice(0, 10))
    );
    successDays = distinct.size;
    refundEstimateYen = Math.min(
      (successDays + challenge.graceDays) * challenge.dailyForfeitYen,
      challenge.depositYen
    );
    const msPerDay = 1000 * 60 * 60 * 24;
    daysRemaining = Math.max(
      0,
      Math.ceil((challenge.endDate.getTime() - today.getTime()) / msPerDay)
    );
    inPeriod = today >= challenge.startDate && today <= challenge.endDate;
  }

  const goals = await prisma.goal.findMany({
    where: { userId: user.id, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  const myRooms = await prisma.roomMember.findMany({
    where: { userId: user.id },
    include: { room: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });

  const initial = user.displayName.trim().charAt(0) || "S";
  const WD = ["月", "火", "水", "木", "金", "土", "日"];

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
                  <span className="stat-num">¥{refundEstimateYen.toLocaleString()}</span>
                  <span className="stat-label">返金見込み</span>
                </div>
              </div>
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
                    <span className="streak-wd">{WD[i]}</span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                残り {daysRemaining} 日 ・ {graceDays}日までお休みOK
              </p>
            </div>

            <p className="sub" style={{ marginTop: 4 }}>
              <Link href="/account" className="muted">アカウント設定・退会</Link>
            </p>
          </aside>

          {/* ===== 中央：記録フィード ===== */}
          <main className="dash-center">
            {!reportedToday && inPeriod && (
              <Link href="/report" className="btn" style={{ marginTop: 0 }}>
                今日の進捗を報告する
              </Link>
            )}
            {reportedToday && (
              <div className="card" style={{ marginTop: 0 }}>
                <strong>✅ 本日は報告済みです</strong>
              </div>
            )}
            {!inPeriod && (
              <div className="card" style={{ marginTop: 0 }}>
                <p className="muted" style={{ margin: 0 }}>チャレンジ期間に入ると報告できます。</p>
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
                  {r.studiedSeconds != null && (
                    <span className="badge" style={{ marginTop: 10 }}>
                      ⏱ {Math.round(r.studiedSeconds / 60)}分 集中
                    </span>
                  )}
                  {r.textContent ? (
                    <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{r.textContent}</p>
                  ) : (
                    !r.photoUrl &&
                    r.studiedSeconds == null && (
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

          {/* ===== 右：勉強部屋 ＋ 目標 ===== */}
          <aside className="dash-right">
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>勉強部屋</strong>
                <Link href="/rooms" className="muted">さがす →</Link>
              </div>
              {myRooms.length === 0 ? (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                  まだ部屋に参加していません。仲間と報告を見せ合うと続けやすくなります。
                </p>
              ) : (
                <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: "1.1em" }}>
                  {myRooms.map((m) => (
                    <li key={m.id}>
                      <Link href={`/rooms/${m.room.id}`}>{m.room.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>目標</strong>
                <Link href="/goals/new" className="muted">追加 →</Link>
              </div>
              {goals.length === 0 ? (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                  まだ目標がありません。
                </p>
              ) : (
                <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: "1.1em" }}>
                  {goals.map((g) => (
                    <li key={g.id}>{g.title}</li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// 今日(または未報告なら昨日)から遡って連続で報告している日数。
function computeStreak(reported: Set<string>, today: Date, reportedToday: boolean): number {
  let streak = 0;
  const cursor = new Date(today);
  if (!reportedToday) cursor.setUTCDate(cursor.getUTCDate() - 1); // 今日未報告なら昨日から数える
  for (let i = 0; i < 400; i++) {
    const ymd = cursor.toISOString().slice(0, 10);
    if (reported.has(ymd)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// 今週(月〜日)の各曜日に報告があったか。
function weekStatus(reported: Set<string>, today: Date): boolean[] {
  // today の曜日(0=日..6=土)から、今週の月曜を求める。
  const dow = today.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  const out: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(reported.has(d.toISOString().slice(0, 10)));
  }
  return out;
}
