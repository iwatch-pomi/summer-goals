"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

// 匿名の登録/ログイン。メール+パスワードで Supabase Auth を使う。
// ヘッダーの「ログイン」「新規登録」から ?mode= で初期タブが決まる。
function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = params.get("mode") === "login" ? "login" : "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setMsg(null);
    const supabase = createBrowserSupabase();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setMsg(error.message);
        return;
      }
      if (!data.session) {
        setMsg(
          "確認メールを送信しました。メール内のリンクを開いて登録を完了し、その後ログインしてください。"
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMsg(
        error.message.includes("Email not confirmed")
          ? "メール未確認です。確認メールのリンクを開いてからログインしてください。"
          : error.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1>{mode === "signup" ? "新規登録" : "ログイン"}</h1>
      <p className="muted">メールアドレスは本人確認・通知にのみ使用します（匿名で利用できます）。</p>

      <form onSubmit={submit}>
        <label>メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <label>パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8文字以上"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />

        {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "処理中..." : mode === "signup" ? "登録して次へ" : "ログイン"}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
        {mode === "signup" ? "アカウントをお持ちですか？ " : "はじめての方は "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode(mode === "signup" ? "login" : "signup");
          }}
        >
          {mode === "signup" ? "ログイン" : "新規登録"}
        </a>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="muted">読み込み中...</p>}>
      <AuthForm />
    </Suspense>
  );
}
