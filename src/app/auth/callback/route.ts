import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// GET /auth/callback
// メール確認リンク（およびOAuth）の戻り先。?code=... を受け取り、
// セッションに交換して Cookie に保存する。メール確認を有効にしている場合に使う。
// ※Supabase 側の URL Configuration に
//   https://<あなたのドメイン>/auth/callback を Redirect URL として登録すること。
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  // オープンリダイレクト対策: 同一サイト内の相対パス（/... かつ //... でない）のみ許可。
  const nextParam = req.nextUrl.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (
            toSet: { name: string; value: string; options: CookieOptions }[]
          ) => {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
