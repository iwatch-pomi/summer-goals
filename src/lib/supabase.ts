import { createClient } from "@supabase/supabase-js";

// ブラウザ/サーバー共用の anon クライアント（認証・公開操作用）。
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

// サーバー専用の service-role クライアント（ストレージ書き込み・管理操作用）。
// service role key は強い権限を持つので絶対にクライアントへ出さない。
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "reports";
