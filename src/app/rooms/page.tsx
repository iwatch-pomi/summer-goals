import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateRoomForm, JoinLeaveButton } from "@/components/RoomButtons";

export const dynamic = "force-dynamic";

const GENRE_LABEL: Record<string, string> = {
  ENGLISH: "英語学習",
  MUSCLE_TRAINING: "筋トレ",
  STUDY: "勉強・資格",
  READING: "読書",
  DIET: "ダイエット",
  OTHER: "その他",
};

// 部屋一覧。未ログインでも閲覧できる（作成・入室はログイン後）。
export default async function RoomsPage() {
  const user = await getCurrentUser();

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });

  // ログイン時は参加中の部屋IDを取得。
  let joinedIds = new Set<string>();
  if (user) {
    const mem = await prisma.roomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    });
    joinedIds = new Set(mem.map((m) => m.roomId));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>部屋をさがす</h1>
        <Link href={user ? "/dashboard" : "/"} className="muted">
          {user ? "← マイページ" : "← トップ"}
        </Link>
      </div>
      <p className="muted">
        一緒にやる仲間と「部屋」で報告を見せ合えます。報告自体はソロでもOK（参加は任意）。
      </p>

      {user?.paidMember ? (
        <CreateRoomForm />
      ) : (
        <p className="muted">
          {user ? (
            <>
              部屋の作成・入室は参加（¥3,500）後にできます。{" "}
              <Link href="/enroll">参加する</Link>
            </>
          ) : (
            <>
              部屋の作成・入室には{" "}
              <Link href="/signup?mode=login">ログイン</Link> が必要です。
            </>
          )}
        </p>
      )}

      {rooms.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          まだ部屋がありません。
        </p>
      )}

      {rooms.map((r) => {
        const joined = joinedIds.has(r.id);
        return (
          <div className="card" key={r.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                {r.genre && (
                  <span className="badge" style={{ marginBottom: 6 }}>
                    {GENRE_LABEL[r.genre] ?? r.genre}
                  </span>
                )}
                <h3 style={{ margin: "4px 0" }}>
                  <Link href={`/rooms/${r.id}`}>{r.name}</Link>
                </h3>
                {r.description && (
                  <p className="muted" style={{ margin: 0 }}>
                    {r.description}
                  </p>
                )}
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  👥 {r._count.members} / {r.maxMembers} 人
                </p>
              </div>

              {user?.paidMember ? (
                <JoinLeaveButton roomId={r.id} joined={joined} />
              ) : (
                <Link
                  href={user ? "/enroll" : "/signup?mode=login"}
                  className="btn-secondary"
                  style={{ width: "auto", margin: 0, padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  {user ? "参加して入室" : "ログインして参加"}
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
