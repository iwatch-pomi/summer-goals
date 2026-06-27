"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAnonClient } from "@/lib/supabase";

// 匿名サインアップ。メール+パスワードで Supabase Auth に登録/ログインする。
// 本名は不要。表示名はサーバー側で匿名ニックネームを自動生成する。
export default function SignupPage() {
  const router = useRouter();
  const supabase = createAnonClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);
    const fn =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    // 参加費の支払いへ。
    router.push("/enroll");
  }

  return (
    <div>
      <h1>{mode === "signup" ? "新規登録" : "ログイン"}</h1>
      <p className="muted">メールアドレスは本人確認・通知にのみ使用します（匿名で利用できます）。</p>

      <label>メールアドレス</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <label>パスワード</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="8文字以上"
      />

      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}

      <button onClick={submit} disabled={loading}>
        {loading ? "処理中..." : mode === "signup" ? "登録して次へ" : "ログイン"}
      </button>

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
