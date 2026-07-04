import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";
import { JoinLeaveButton } from "@/components/RoomButtons";

export const dynamic = "force-dynamic";

// 部屋ボード。ログイン時はメンバーの「今日の報告状況＋内容」を表示。
// 未ログインは中身（本文・写真）を出さず、部屋情報＋ログイン導線のみ（ティザー）。
export default async function RoomBoardPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, displayName: true, university: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!room) {
    return (
      <div>
        <h1>部屋が見つかりません</h1>
        <Link href="/rooms" className="btn">
          部屋一覧へ
        </Link>
      </div>
    );
  }

  const header = (
    <>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h1 style={{ margin: 0 }}>{room.name}</h1>
        <Link href="/rooms" className="muted">
          ← 一覧
        </Link>
      </div>
      {room.description && <p className="muted">{room.description}</p>}
    </>
  );

  // 未ログイン: ティザー（メンバー数・ニックネームのみ、報告内容は非表示）。
  if (!user) {
    return (
      <div>
        {header}
        <p className="muted">👥 {room.members.length} 人が参加中</p>
        <div className="card">
          <p>この部屋のメンバー</p>
          <ul className="muted">
            {room.members.map((m) => (
              <li key={m.id}>{m.user.displayName}</li>
            ))}
          </ul>
          <p className="muted">
            メンバーの日々の報告を見たり、参加するにはログインが必要です。
          </p>
          <Link href="/signup?mode=login" className="btn">
            ログインして中を見る
          </Link>
        </div>
      </div>
    );
  }

  const joined = room.members.some((m) => m.userId === user.id);

  // メンバー限定: 非メンバー（未参加）には報告内容（本文・写真）を出さず、参加導線のみ。
  if (!joined) {
    return (
      <div>
        {header}
        <p className="muted">👥 {room.members.length} 人が参加中</p>
        <div className="card">
          <p>この部屋のメンバー</p>
          <ul className="muted">
            {room.members.map((m) => (
              <li key={m.id}>{m.user.displayName}</li>
            ))}
          </ul>
          <p className="muted">メンバーの日々の報告は、参加すると見られます。</p>
          {user.paidMember ? (
            <JoinLeaveButton roomId={room.id} joined={false} />
          ) : (
            <Link href="/enroll" className="btn">
              参加（¥3,500）して入室する
            </Link>
          )}
        </div>
      </div>
    );
  }

  const today = toDateOnly(jstDateString());
  const memberIds = room.members.map((m) => m.userId);

  const todayReports = await prisma.report.findMany({
    where: { userId: { in: memberIds }, reportDate: today },
  });
  const reportByUser = new Map(todayReports.map((r) => [r.userId, r]));

  const signedByUser = new Map<string, string>();
  for (const r of todayReports) {
    if (r.photoUrl) {
      const url = await createSignedReportUrl(r.photoUrl);
      if (url) signedByUser.set(r.userId, url);
    }
  }

  return (
    <div>
      {header}
      <p className="muted">
        今日の報告: {todayReports.length} / {room.members.length} 人
      </p>

      {user.paidMember && (
        <div style={{ margin: "8px 0 16px" }}>
          <JoinLeaveButton roomId={room.id} joined={joined} />
        </div>
      )}

      {room.members.map((m) => {
        const r = reportByUser.get(m.userId);
        const photo = signedByUser.get(m.userId);
        const isMe = m.userId === user.id;
        return (
          <div className="card" key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>
                {m.user.displayName}
                {m.user.university && (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {" "}
                    · {m.user.university}
                  </span>
                )}
                {isMe && <span className="muted">（あなた）</span>}
              </strong>
              <span>{r ? "✅ 報告済み" : "⏳ 未報告"}</span>
            </div>
            {r && (
              <>
                <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
                  {r.textContent}
                </p>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt="進捗写真"
                    style={{
                      marginTop: 8,
                      width: "100%",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
