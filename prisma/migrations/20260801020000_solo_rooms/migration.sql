-- ===========================================================================
-- ソロ報告化 ＋ ルーム機能 への移行（init からの差分）
-- 既存DBには Supabase SQL Editor でこのファイルの内容を1回実行すればよい。
-- ===========================================================================

-- 1) Report から Match 依存を除去
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_matchId_fkey";
DROP INDEX IF EXISTS "Report_matchId_reportDate_idx";
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_matchId_userId_reportDate_key";

-- 旧テスト報告（challenge 未紐付け）は掃除してから NOT NULL 化
DELETE FROM "Report" WHERE "challengeId" IS NULL;

ALTER TABLE "Report" DROP COLUMN IF EXISTS "matchId";
ALTER TABLE "Report" ALTER COLUMN "challengeId" SET NOT NULL;

-- 2) Match 本体と enum を削除
DROP TABLE IF EXISTS "Match";
DROP TYPE IF EXISTS "MatchStatus";

-- 3) Report の新しいユニーク/インデックス（1チャレンジ1日1報告）
DROP INDEX IF EXISTS "Report_challengeId_reportDate_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Report_challengeId_reportDate_key" ON "Report"("challengeId", "reportDate");
CREATE INDEX IF NOT EXISTS "Report_userId_reportDate_idx" ON "Report"("userId", "reportDate");

-- 4) Goal.status の既定を ACTIVE に
ALTER TABLE "Goal" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- 5) Room / RoomMember を追加
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genre" "GoalGenre",
    "createdById" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Room_createdAt_idx" ON "Room"("createdAt");
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");
CREATE INDEX "RoomMember_roomId_idx" ON "RoomMember"("roomId");

ALTER TABLE "Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
