-- ===========================================================================
-- 根本転換：課金撤去＋公開宣言モデルへ
--  ・Report を Challenge から Goal に付け替え
--  ・Challenge / WebhookEvent / payment enums / User の Stripe カラムを撤去
--  ・Goal.isPublic 追加、Cheer（応援）テーブル追加
--
-- ※ Report.challengeId → goalId は 1:1 対応が付けられないため、
--    既存のテスト用 Report を一旦すべて削除してから付け替える。
--    （本番前のテストデータのみ。実データはまだ無い前提）
-- ===========================================================================

-- 1) 既存の報告を消去（付け替え不能なため）
DELETE FROM "Report";

-- 2) Report を Goal に付け替え
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_challengeId_fkey";
DROP INDEX IF EXISTS "Report_challengeId_reportDate_key";
DROP INDEX IF EXISTS "Report_challengeId_reportDate_idx";
ALTER TABLE "Report" DROP COLUMN IF EXISTS "challengeId";

ALTER TABLE "Report" ADD COLUMN "goalId" TEXT NOT NULL; -- 表が空なので NOT NULL 可
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Report_goalId_reportDate_key" ON "Report"("goalId", "reportDate");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
-- "Report_userId_reportDate_idx" は既存のものを流用

-- 3) Goal に isPublic
ALTER TABLE "Goal" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Goal_isPublic_createdAt_idx" ON "Goal"("isPublic", "createdAt");

-- 4) Cheer（応援）テーブル
CREATE TABLE "Cheer" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "goalId"    TEXT,
  "reportId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cheer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cheer_userId_goalId_key" ON "Cheer"("userId", "goalId");
CREATE UNIQUE INDEX "Cheer_userId_reportId_key" ON "Cheer"("userId", "reportId");
CREATE INDEX "Cheer_goalId_idx" ON "Cheer"("goalId");
CREATE INDEX "Cheer_reportId_idx" ON "Cheer"("reportId");
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) 決済まわりを撤去
DROP TABLE IF EXISTS "Challenge";
DROP TABLE IF EXISTS "WebhookEvent";
DROP TYPE IF EXISTS "ChallengePaymentStatus";
DROP TYPE IF EXISTS "ChallengeStatus";
DROP TYPE IF EXISTS "SettlementStatus";

-- 6) User の Stripe カラム撤去
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "defaultPaymentMethodId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "cardRegistered";
ALTER TABLE "User" DROP COLUMN IF EXISTS "paidMember";
