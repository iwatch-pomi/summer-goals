-- ユーザーネームの一意化 ＋ Googleログインの初回設定フラグ。
-- 既存DBには Supabase SQL Editor でこの内容を1回実行する。
--
-- ※既存に同じ displayName の重複があると、一意インデックス作成が失敗する。
--   その場合は先に重複を解消（テストなら該当ユーザー削除など）してから実行すること。

-- ユーザーネームを一意に
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- Google 初回のユーザーネーム設定判定用フラグ
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileComplete" BOOLEAN NOT NULL DEFAULT false;

-- 既存ユーザーは設定済み扱いにして onboarding を強制しない
UPDATE "User" SET "profileComplete" = true;
