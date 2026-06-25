import Link from "next/link";
import { GoalStatus, MatchStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDateString } from "@/lib/dates";

export const dynamic = "force-dynamic"; // ログインユーザーごとに描画

// ダッシュボード。カード未登録・目標なし・マッチ状況に応じて表示を切り替える。
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

  if (!user.cardRegistered) {
    return (
      <div>
        <h1>あと一歩！</h1>
        <p className="muted">マッチングの前にカード登録が必要です。</p>
        <Link href="/card" className="btn">
          カードを登録する
        </Link>
      </div>
    );
  }

  const todayYmd = jstDateString();

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
      <h1>こんにちは、{user.displayName} さん</h1>

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
