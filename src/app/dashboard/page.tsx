import Link from "next/link";
import { ChallengeStatus, GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDateString, toDateOnly } from "@/lib/dates";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic"; // ログインユーザーごとに描画

// ダッシュボード（ソロ）。返金見込み・今日の報告・目標・参加中の部屋を表示。
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

  const challenge = await prisma.challenge.findFirst({
    where: { userId: user.id, status: ChallengeStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });

  // 今日すでに報告したか。
  const reportedToday = challenge
    ? (await prisma.report.count({
        where: { challengeId: challenge.id, reportDate: today },
      })) > 0
    : false;

  let summary: {
    successDays: number;
    refundEstimateYen: number;
    daysRemaining: number;
    depositYen: number;
    inPeriod: boolean;
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
    summary = {
      successDays,
      refundEstimateYen: Math.min(
        successDays * challenge.dailyForfeitYen,
        challenge.depositYen
      ),
      daysRemaining: Math.max(
        0,
        Math.ceil((challenge.endDate.getTime() - today.getTime()) / msPerDay)
      ),
      depositYen: challenge.depositYen,
      inPeriod: today >= challenge.startDate && today <= challenge.endDate,
    };
  }

  const goals = await prisma.goal.findMany({
    where: { userId: user.id, status: GoalStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });

  const myRooms = await prisma.roomMember.findMany({
    where: { userId: user.id },
    include: { room: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
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

      {summary && (
        <div className="card">
          <span className="badge">チャレンジ進行中</span>
          <p style={{ fontSize: "1.25rem", margin: "8px 0" }}>
            返金見込み <strong>¥{summary.refundEstimateYen.toLocaleString()}</strong>
            <span className="muted"> / ¥{summary.depositYen.toLocaleString()}</span>
          </p>
          <p className="muted">
            報告成功 {summary.successDays} 日 ・ 残り {summary.daysRemaining} 日
            <br />
            ※毎日報告するほど返金額が増えます（1日 ¥100）。
          </p>
        </div>
      )}

      {/* 今日の報告 */}
      <div className="card">
        <strong>今日の報告</strong>
        <p style={{ margin: "8px 0" }}>
          {reportedToday ? "✅ 本日は報告済みです" : "⚠️ まだ報告していません"}
        </p>
        {!reportedToday && summary?.inPeriod && (
          <Link href="/report" className="btn">
            今日の進捗を報告する
          </Link>
        )}
        {!summary?.inPeriod && (
          <p className="muted" style={{ margin: 0 }}>
            チャレンジ期間に入ると報告できます。
          </p>
        )}
      </div>

      {/* 目標 */}
      <div className="card">
        <strong>あなたの目標</strong>
        {goals.length === 0 ? (
          <>
            <p className="muted">まだ目標がありません。</p>
            <Link href="/goals/new" className="btn">
              目標を設定する
            </Link>
          </>
        ) : (
          <>
            <ul className="muted">
              {goals.map((g) => (
                <li key={g.id}>{g.title}</li>
              ))}
            </ul>
            <Link href="/goals/new" className="muted">
              ＋ 目標を追加
            </Link>
          </>
        )}
      </div>

      {/* 部屋 */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>参加中の部屋</strong>
          <Link href="/rooms" className="muted">
            部屋をさがす →
          </Link>
        </div>
        {myRooms.length === 0 ? (
          <p className="muted">
            まだどの部屋にも参加していません。一人でも続けられますが、仲間と報告を見せ合うと続けやすくなります。
          </p>
        ) : (
          <ul className="muted">
            {myRooms.map((m) => (
              <li key={m.id}>
                <Link href={`/rooms/${m.room.id}`}>{m.room.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
