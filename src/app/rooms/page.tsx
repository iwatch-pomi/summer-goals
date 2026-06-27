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

// 部屋一覧。常時アクセスでき、作成・入室・退室ができる。
export default async function RoomsPage() {
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

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { id: true } },
    },
  });

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
        <Link href="/dashboard" className="muted">
          ← ダッシュボード
        </Link>
      </div>
      <p className="muted">
        一緒にやる仲間と「部屋」で報告を見せ合えます。報告自体はソロでもOK（参加は任意）。
      </p>

      {user.paidMember ? (
        <CreateRoomForm />
      ) : (
        <p className="muted">部屋の作成・入室は参加（¥3,500）後にできます。</p>
      )}

      {rooms.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          まだ部屋がありません。最初の部屋を作ってみましょう。
        </p>
      )}

      {rooms.map((r) => {
        const joined = r.members.length > 0;
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
                {r.description && <p className="muted" style={{ margin: 0 }}>{r.description}</p>}
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  👥 {r._count.members} / {r.maxMembers} 人
                </p>
              </div>
              {user.paidMember && (
                <JoinLeaveButton roomId={r.id} joined={joined} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
