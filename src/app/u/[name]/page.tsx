import Link from "next/link";
import { GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";
import { computeStreak, weekStatus, reportedDateSet, WEEKDAY_LABELS } from "@/lib/streak";
import { loadCheers } from "@/lib/cheers";
import CheerButton from "@/components/CheerButton";

export const dynamic = "force-dynamic";

// 共有プロフィール（ログイン不要）。SNS に貼れる公開ページ。
export default async function ProfilePage({ params }: { params: { name: string } }) {
  const displayName = decodeURIComponent(params.name);
  const viewer = await getCurrentUser();

  const owner = await prisma.user.findUnique({
    where: { displayName },
    select: { id: true, displayName: true, university: true },
  });

  if (!owner) {
    return (
      <div>
        <h1>ユーザーが見つかりません</h1>
        <Link href="/feed" className="btn">みんなの進捗へ</Link>
      </div>
    );
  }

  const todayYmd = jstDateString();
  const today = toDateOnly(todayYmd);

  const goals = (await prisma.goal.findMany({
    where: { userId: owner.id, isPublic: true, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true },
  })) as Array<{ id: string; title: string; description: string | null }>;

  const reports = (await prisma.report.findMany({
    where: { userId: owner.id, goal: { isPublic: true } },
    orderBy: { reportDate: "desc" },
    take: 60,
    select: {
      id: true,
      reportDate: true,
      textContent: true,
      pagesRead: true,
      photoUrl: true,
      studiedSeconds: true,
      goal: { select: { title: true } },
    },
  })) as Array<{
    id: string;
    reportDate: Date;
    textContent: string;
    pagesRead: number | null;
    photoUrl: string | null;
    studiedSeconds: number | null;
    goal: { title: string };
  }>;

  const signedUrls = await Promise.all(
    reports.map((r) => (r.photoUrl ? createSignedReportUrl(r.photoUrl) : Promise.resolve(null)))
  );

  const reportedSet = reportedDateSet(reports.map((r) => r.reportDate));
  const reportedToday = reportedSet.has(todayYmd);
  const currentStreak = computeStreak(reportedSet, today, reportedToday);
  const week = weekStatus(reportedSet, today);

  const cheersReceived = await prisma.cheer.count({
    where: { OR: [{ goal: { userId: owner.id } }, { report: { userId: owner.id } }] },
  });

  const cheers = await loadCheers(
    goals.map((g) => g.id),
    reports.map((r) => r.id),
    viewer?.id
  );
  const loggedIn = !!viewer;
  const initial = owner.displayName.trim().charAt(0) || "S";

  return (
    <div>
      <div className="card profile-card">
        <div className="profile-avatar">{initial}</div>
        <h1 style={{ margin: "10px 0 2px", fontSize: "1.4rem" }}>{owner.displayName}</h1>
        {owner.university && <p className="muted" style={{ margin: 0 }}>{owner.university}</p>}
        <div className="profile-stats">
          <div>
            <span className="stat-num">{reportedSet.size}</span>
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
        <div className="streak-week" style={{ maxWidth: 280, margin: "14px auto 0" }}>
          {week.map((done, i) => (
            <div key={i} className="streak-day">
              <span className={done ? "streak-dot on" : "streak-dot"}>{done ? "✓" : ""}</span>
              <span className="streak-wd">{WEEKDAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>取り組み中の参考書</h3>
      {goals.length === 0 ? (
        <p className="muted">公開中の参考書はありません。</p>
      ) : (
        goals.map((g) => (
          <div className="card" key={g.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>📖 {g.title}</p>
                {g.description && <p className="muted" style={{ margin: "4px 0 0" }}>{g.description}</p>}
              </div>
              <CheerButton
                goalId={g.id}
                initialCount={cheers.count("goal", g.id)}
                initialCheered={cheers.mine("goal", g.id)}
                loggedIn={loggedIn}
              />
            </div>
          </div>
        ))
      )}

      <h3 style={{ marginTop: 24 }}>進捗</h3>
      {reports.length === 0 ? (
        <p className="muted">まだ進捗がありません。</p>
      ) : (
        reports.map((r, i) => (
          <div className="card feed-item" key={r.id}>
            <div className="feed-head">
              <div className="feed-avatar">{initial}</div>
              <div>
                <strong>{owner.displayName}</strong>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  📖 {r.goal.title} ・{" "}
                  {r.reportDate.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
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
                style={{ marginTop: 10, width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
              />
            )}
            <div style={{ marginTop: 12 }}>
              <CheerButton
                reportId={r.id}
                initialCount={cheers.count("report", r.id)}
                initialCheered={cheers.mine("report", r.id)}
                loggedIn={loggedIn}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
