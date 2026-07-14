"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

// 全ページ共通ヘッダー（Amazon型）。ログイン状態に応じて右側の導線を出し分ける。
// - 未ログイン: 「ログイン」＋「新規登録」
// - ログイン済: 「マイページ」＋「ログアウト」
// - どちらでも: ロゴ／「みんなの進捗」「ランキング」リンク（公開）
export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const onAuthPage = pathname?.startsWith("/signup") ?? false;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={loggedIn ? "/dashboard" : "/"} className="logo">
          ススメ<span>ランキング</span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* ログイン/新規登録画面では右側の導線を出さない */}
          {!onAuthPage && (
            <Link href="/ranking" className="muted" style={{ fontWeight: 700 }}>
              ランキング
            </Link>
          )}
          {!onAuthPage && (
            <Link href="/feed" className="muted" style={{ fontWeight: 700 }}>
              みんなの進捗
            </Link>
          )}

          {/* loggedIn === null（判定中）は何も出さずチラつき防止 */}
          {loggedIn === true && (
            <>
              <Link href="/dashboard" className="btn-pill">
                マイページ
              </Link>
              <a
                href="#"
                className="muted"
                onClick={(e) => {
                  e.preventDefault();
                  logout();
                }}
              >
                ログアウト
              </a>
            </>
          )}

          {loggedIn === false && !onAuthPage && (
            <>
              <Link href="/signup?mode=login" className="muted" style={{ fontWeight: 700 }}>
                ログイン
              </Link>
              <Link href="/signup?mode=signup" className="btn-pill">
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
