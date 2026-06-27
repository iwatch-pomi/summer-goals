"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

// 全ページ共通ヘッダー。ログイン状態とページに応じて右上のボタンを出し分ける。
// - 未ログイン: 「エントリー」(/signup)
// - ログイン済: 「マイページ」(/dashboard)
// - サインイン/登録ページ: ボタンなし（その画面自体がエントリーのため）
export default function SiteHeader() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onAuthPage = pathname?.startsWith("/signup") ?? false;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="logo">
          Summer<span>Goals</span>
        </Link>

        {/* loggedIn === null（判定中）は何も出さずチラつきを防ぐ */}
        {!onAuthPage && loggedIn === true && (
          <Link href="/dashboard" className="btn-pill">
            マイページ
          </Link>
        )}
        {!onAuthPage && loggedIn === false && (
          <Link href="/signup" className="btn-pill">
            エントリー
          </Link>
        )}
      </div>
    </header>
  );
}
