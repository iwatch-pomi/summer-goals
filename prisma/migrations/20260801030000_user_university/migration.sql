-- 登録時のプロフィール項目（大学名）を追加。
-- 既存DBには Supabase SQL Editor でこの1行を実行すればよい。
-- （displayName は既存カラムを「公開ユーザーネーム」に流用するため変更不要）
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "university" TEXT;
