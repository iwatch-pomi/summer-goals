-- チャレンジごとの猶予日数（開始30日間に含まれる土日数）を保存する列を追加。
-- 既存行は従来の固定値 8 を既定とする。
ALTER TABLE "Challenge" ADD COLUMN "graceDays" INTEGER NOT NULL DEFAULT 8;
