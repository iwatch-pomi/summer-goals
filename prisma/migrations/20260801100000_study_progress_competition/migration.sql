-- ===========================================================================
-- 参考書ランキングへの転換
--  ・GoalGenre を科目タグ（受験・資格向け）へ入れ替え
--  ・Goal.totalPages（総ページ数）／ Report.pagesRead（進めたページ数）を追加
--  ・勉強部屋（Room / RoomMember）を撤去
-- ===========================================================================

-- 1) 参考書メタ・進捗ページ数のカラム追加（NULL 可）
ALTER TABLE "Goal" ADD COLUMN "totalPages" INTEGER;
ALTER TABLE "Report" ADD COLUMN "pagesRead" INTEGER;

-- 2) GoalGenre enum の値を入れ替え（新規作成 → USING で付け替え → 旧型 DROP）
--    廃止値（MUSCLE_TRAINING / READING / DIET / STUDY）を使う既存行は OTHER に寄せる。
ALTER TYPE "GoalGenre" RENAME TO "GoalGenre_old";
CREATE TYPE "GoalGenre" AS ENUM (
  'ENGLISH', 'MATH', 'JAPANESE', 'SCIENCE', 'SOCIAL',
  'TOEIC', 'QUALIFICATION', 'MAJOR', 'OTHER'
);
ALTER TABLE "Goal"
  ALTER COLUMN "genre" TYPE "GoalGenre"
  USING (
    CASE "genre"::text
      WHEN 'ENGLISH' THEN 'ENGLISH'
      ELSE 'OTHER'
    END
  )::"GoalGenre";
DROP TYPE "GoalGenre_old";

-- 3) 勉強部屋を撤去
DROP TABLE IF EXISTS "RoomMember";
DROP TABLE IF EXISTS "Room";
