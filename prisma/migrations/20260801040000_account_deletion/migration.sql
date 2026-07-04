-- 退会機能（7日間の猶予つきソフトデリート）用のカラムを追加。
-- 既存DBには Supabase SQL Editor でこの1行を実行すればよい。
-- status は既存カラム（'ACTIVE' / 'PENDING_DELETION' を格納）を流用する。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3);
