import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedReportUrl } from "@/lib/supabase";
import { jstDateString, toDateOnly } from "@/lib/dates";
import { JoinLeaveButton } from "@/components/RoomButtons";

export const dynamic = "force-dynamic";

// 部屋ボード。メンバーの「今日の報告状況＋内容」を見せ合う。
export default async function RoomBoardPage({
  params,
}: {
  params: { id: string };
}) {
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

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: { select: { id: true, displayName: true } } },
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

  const joined = room.members.some((m) => m.userId === user.id);
  const today = toDateOnly(jstDateString());
  const memberIds = room.members.map((m) => m.userId);

  // メンバーの今日の報告を一括取得し userId で引けるように。
  const todayReports = await prisma.report.findMany({
    where: { userId: { in: memberIds }, reportDate: today },
  });
  const reportByUser = new Map(todayReports.map((r) => [r.userId, r]));

  // 写真は非公開バケットなので署名URLを発行。
  const signedByUser = new Map<string, string>();
  for (const r of todayReports) {
    if (r.photoUrl) {
      const url = await createSignedReportUrl(r.photoUrl);
      if (url) signedByUser.set(r.userId, url);
    }
  }

  const reportedCount = todayReports.length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>{room.name}</h1>
        <Link href="/rooms" className="muted">
          ← 一覧
        </Link>
      </div>
      {room.description && <p className="muted">{room.description}</p>}
      <p className="muted">
        今日の報告: {reportedCount} / {room.members.length} 人
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
