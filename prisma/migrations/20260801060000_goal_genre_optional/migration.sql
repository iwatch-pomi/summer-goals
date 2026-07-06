-- 目標のジャンルを任意（NULL 許可）にする。
-- 目標は個人のもの。ジャンルは分類用の任意タグに変更。
ALTER TABLE "Goal" ALTER COLUMN "genre" DROP NOT NULL;
