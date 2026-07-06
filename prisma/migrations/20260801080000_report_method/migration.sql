-- 報告方法を目標登録時に選べるようにする。
-- Goal に報告方法（写真／ボタン／タイマー）と規定分数、Report に集中秒数を追加。
CREATE TYPE "ReportMethod" AS ENUM ('PHOTO', 'BUTTON', 'TIMER');

ALTER TABLE "Goal" ADD COLUMN "reportMethod" "ReportMethod" NOT NULL DEFAULT 'PHOTO';
ALTER TABLE "Goal" ADD COLUMN "studyMinutes" INTEGER;

ALTER TABLE "Report" ADD COLUMN "studiedSeconds" INTEGER;
