import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { Prisma } from "@prisma/client";
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

  // 登録時に signUp(options.data) で渡した公開ユーザーネーム・大学名を反映。
  // 未指定ならランダムな匿名ニックネームにフォールバック。
  const meta = (user.user_metadata ?? {}) as {
    username?: unknown;
    university?: unknown;
  };
  // メール登録は username を持つ → 設定済み。Google 等は無い → onboarding で設定。
  const hasUsername =
    typeof meta.username === "string" && meta.username.trim().length > 0;
  const displayName = hasUsername
    ? (meta.username as string).trim().slice(0, 30)
    : randomDisplayName();
  const university =
    typeof meta.university === "string" && meta.university.trim()
      ? meta.university.trim().slice(0, 60)
      : null;

  // 初回ログイン時の二重作成（email/displayName の unique 違反）を安全に処理する。
  try {
    return await prisma.user.create({
      data: {
        email: user.email,
        displayName,
        university,
        profileComplete: hasUsername,
        avatarSeed: user.id,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // 並行リクエストが email を先に作成済みなら、それを返す。
      const byEmail = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (byEmail) return byEmail;
      // displayName 衝突 → 数字サフィックスを付けて再作成（login を壊さない）。
      return prisma.user.create({
        data: {
          email: user.email,
          displayName: `${displayName}${Math.floor(Math.random() * 100000)}`,
          university,
          profileComplete: hasUsername,
          avatarSeed: user.id,
        },
      });
    }
    throw e;
  }
}

/** 認証必須の API 用。未ログインなら例外を投げる。 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}
