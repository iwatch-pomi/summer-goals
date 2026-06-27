import Link from "next/link";
import { ChallengeStatus, GoalStatus, MatchStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDateString, toDateOnly } from "@/lib/dates";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic"; // ログインユーザーごとに描画

// ダッシュボード。未参加・目標なし・マッチ状況に応じて表示を切り替える。
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <h1>ログインが必要です</h1>
        <Link href="/signup" className="btn">
          ログイン / 新規登録
        </Link>
      </div>
    );
  }

  if (!user.paidMember) {
    return (
      <div>
        <h1>あと一歩！</h1>
        <p className="muted">
          チャレンジ参加には参加費（¥3,500）のお支払いが必要です。
          内訳: 参加費 ¥500（返金不可）＋ デポジット ¥3,000（報告した日数に応じて返金）。
        </p>
        <Link href="/enroll" className="btn">
          ¥3,500 を支払って参加する
        </Link>
      </div>
    );
  }

  const todayYmd = jstDateString();
  const today = toDateOnly(todayYmd);

  // 進行中チャレンジ（返金見込みの計算）。
  const challenge = await prisma.challenge.findFirst({
    where: { userId: user.id, status: ChallengeStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });

  let challengeSummary: {
    successDays: number;
    refundEstimateYen: number;
    daysRemaining: number;
    depositYen: number;
  } | null = null;

  if (challenge) {
    const reportedDays = await prisma.report.findMany({
      where: {
        challengeId: challenge.id,
        reportDate: { gte: challenge.startDate, lte: challenge.endDate },
      },
      distinct: ["reportDate"],
      select: { reportDate: true },
    });
    const successDays = reportedDays.length;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.max(
      0,
      Math.ceil((challenge.endDate.getTime() - today.getTime()) / msPerDay)
    );
    challengeSummary = {
      successDays,
      refundEstimateYen: Math.min(
        successDays * challenge.dailyForfeitYen,
        challenge.depositYen
      ),
      daysRemaining,
      depositYen: challenge.depositYen,
    };
  }

  // 進行中マッチ（自分が当事者）を取得。
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.ACTIVE,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: {
      userA: { select: { displayName: true } },
      userB: { select: { displayName: true } },
      goalA: true,
      goalB: true,
      reports: { where: { reportDate: { equals: new Date(`${todayYmd}T00:00:00.000Z`) } } },
    },
  });

  // マッチ待ちの目標。
  const waitingGoals = await prisma.goal.findMany({
    where: { userId: user.id, status: GoalStatus.MATCHING },
  });

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

      {challengeSummary && (
        <div className="card">
          <span className="badge">チャレンジ進行中</span>
          <p style={{ fontSize: "1.25rem", margin: "8px 0" }}>
            返金見込み <strong>¥{challengeSummary.refundEstimateYen.toLocaleString()}</strong>
            <span className="muted"> / ¥{challengeSummary.depositYen.toLocaleString()}</span>
          </p>
          <p className="muted">
            報告成功 {challengeSummary.successDays} 日 ・ 残り {challengeSummary.daysRemaining} 日
            <br />
            ※毎日報告するほど返金額が増えます（1日 ¥100）。
          </p>
        </div>
      )}

      {matches.length === 0 && waitingGoals.length === 0 && (
        <div className="card">
          <p>まだ目標がありません。</p>
          <Link href="/goals/new" className="btn">
            目標を設定する
          </Link>
        </div>
      )}

      {waitingGoals.map((g) => (
        <div className="card" key={g.id}>
          <span className="badge">マッチング待ち</span>
          <h3>{g.title}</h3>
          <p className="muted">同じジャンルの相方を探しています…</p>
        </div>
      ))}

      {matches.map((m) => {
        const isA = m.userAId === user.id;
        const myGoal = isA ? m.goalA : m.goalB;
        const partnerName = isA ? m.userB.displayName : m.userA.displayName;
        const iReportedToday = m.reports.some((r) => r.userId === user.id);
        const partnerReportedToday = m.reports.some((r) => r.userId !== user.id);
        return (
          <div className="card" key={m.id}>
            <span className="badge">進行中</span>
            <h3>{myGoal.title}</h3>
            <p className="muted">相方: {partnerName}</p>
            <p>
              今日のあなた: {iReportedToday ? "✅ 報告済み" : "⚠️ 未報告"}
              <br />
              今日の相方: {partnerReportedToday ? "✅ 報告済み" : "⏳ まだ"}
            </p>
            {!iReportedToday && (
              <Link href={`/report?matchId=${m.id}`} className="btn">
                今日の進捗を報告する
              </Link>
            )}
          </div>
        );
      })}

      {matches.length > 0 && (
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/goals/new">別ジャンルの目標を追加</Link>
        </p>
      )}
    </div>
  );
}
