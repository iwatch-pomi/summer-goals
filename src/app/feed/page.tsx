import Link from "next/link";
import { GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { loadCheers } from "@/lib/cheers";
import CheerButton from "@/components/CheerButton";

export const dynamic = "force-dynamic";

const profilePath = (name: string) => `/u/${encodeURIComponent(name)}`;
const initialOf = (name: string) => name.trim().charAt(0) || "S";

// みんなの進捗タイムライン（ログイン不要で閲覧可）。
// 上部＝新しい参考書、下部＝みんなの進捗。各項目にワンタップ応援。
export default async function FeedPage() {
  const viewer = await getCurrentUser(); // 未ログインなら null

  const goals = (await prisma.goal.findMany({
    where: { isPublic: true, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      user: { select: { displayName: true, university: true } },
    },
  })) as Array<{
    id: string;
    title: string;
    description: string | null;
    user: { displayName: string; university: string | null };
  }>;

  const reports = (await prisma.report.findMany({
    where: { goal: { isPublic: true } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      reportDate: true,
      textContent: true,
      pagesRead: true,
      photoUrl: true,
      studiedSeconds: true,
      user: { select: { displayName: true } },
      goal: { select: { title: true } },
    },
  })) as Array<{
    id: string;
    reportDate: Date;
    textContent: string;
    pagesRead: number | null;
    photoUrl: string | null;
    studiedSeconds: number | null;
    user: { displayName: string };
    goal: { title: string };
  }>;

  const signedUrls = await Promise.all(
    reports.map((r) => (r.photoUrl ? createSignedReportUrl(r.photoUrl) : Promise.resolve(null)))
  );

  const cheers = await loadCheers(
    goals.map((g) => g.id),
    reports.map((r) => r.id),
    viewer?.id
  );
  const loggedIn = !!viewer;

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>みんなの進捗</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        参考書の進捗を見せ合い、競い合う。気になる人を応援しよう。
      </p>

      {/* ===== 新しい参考書 ===== */}
      <h3 style={{ marginTop: 20 }}>新しい参考書</h3>
      {goals.length === 0 ? (
        <p className="muted">まだ参考書がありません。</p>
      ) : (
        goals.map((g) => (
          <div className="card" key={g.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <Link href={profilePath(g.user.displayName)} style={{ fontWeight: 700 }}>
                  {g.user.displayName}
                </Link>
                {g.user.university && (
                  <span className="muted" style={{ fontSize: "0.82rem" }}> · {g.user.university}</span>
                )}
                <p style={{ margin: "6px 0 0", fontWeight: 700 }}>📖 {g.title}</p>
                {g.description && (
                  <p className="muted" style={{ margin: "4px 0 0" }}>{g.description}</p>
                )}
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

      {/* ===== みんなの進捗 ===== */}
      <h3 style={{ marginTop: 24 }}>みんなの進捗</h3>
      {reports.length === 0 ? (
        <p className="muted">まだ進捗がありません。</p>
      ) : (
        reports.map((r, i) => (
          <div className="card feed-item" key={r.id}>
            <div className="feed-head">
              <div className="feed-avatar">{initialOf(r.user.displayName)}</div>
              <div>
                <Link href={profilePath(r.user.displayName)} style={{ fontWeight: 700 }}>
                  {r.user.displayName}
                </Link>
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
