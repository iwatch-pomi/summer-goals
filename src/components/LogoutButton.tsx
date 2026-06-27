"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

// ログアウトボタン。テストで複数アカウントを切り替えるのにも使う。
export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      style={{
        width: "auto",
        margin: 0,
        padding: "6px 12px",
        fontSize: "0.85rem",
        background: "#64748b",
      }}
    >
      ログアウト
    </button>
  );
}
