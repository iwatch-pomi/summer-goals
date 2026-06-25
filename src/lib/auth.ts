import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { prisma } from "./prisma";

// ===========================================================================
// 認証ヘルパー。Supabase Auth のセッション（cookie）から現在のユーザーを取得し、
// アプリの User レコードに対応づける（無ければ作成 = 初回ログイン時のプロビジョニング）。
// ===========================================================================

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          toSet: { name: string; value: string; options: CookieOptions }[]
        ) => {
          // route handler / server action からのみ書き込み可能。
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // server component から呼ばれた場合は無視（middleware で更新）。
          }
        },
      },
    }
  );
}

/** ランダムな匿名ニックネームを生成する。 */
function randomDisplayName(): string {
  const animals = ["カワウソ", "ハリネズミ", "アザラシ", "ペンギン", "コアラ", "フクロウ"];
  const adj = ["ガチ", "本気", "努力", "継続", "全集中", "無敵"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  return `${a}${b}${Math.floor(Math.random() * 1000)}`;
}

/**
 * 現在ログイン中のユーザーを返す。未ログインなら null。
 * 初回はアプリ側 User を自動作成（匿名ニックネーム付与）。
 */
export async function getCurrentUser() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: user.email,
      displayName: randomDisplayName(),
      avatarSeed: user.id,
    },
  });
}

/** 認証必須の API 用。未ログインなら例外を投げる。 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}
