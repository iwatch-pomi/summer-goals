"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

// Supabase の認証エラー（英語）を日本語に変換する。
// code 優先、無ければメッセージ文字列で判定。未知のものは汎用文言。
function translateAuthError(error: { message?: string; code?: string }): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  ) {
    return "このメールアドレスは既に登録されています。ログインしてください。";
  }
  if (code === "weak_password" || msg.includes("password should be at least")) {
    return "パスワードが短すぎます。6文字以上で入力してください。";
  }
  if (
    code === "validation_failed" ||
    msg.includes("unable to validate email") ||
    msg.includes("invalid format") ||
    msg.includes("invalid email")
  ) {
    return "メールアドレスの形式が正しくありません。";
  }
  if (msg.includes("email not confirmed")) {
    return "メール未確認です。確認メールのリンクを開いてからログインしてください。";
  }
  if (
    code.includes("rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("for security purposes") ||
    msg.includes("you can only request this after")
  ) {
    return "リクエストが多すぎます。しばらく時間をおいて再度お試しください。";
  }
  if (msg.includes("password") && msg.includes("required")) {
    return "パスワードを入力してください。";
  }
  // 未知のエラーは原文を添えて汎用文言。
  return "エラーが発生しました。入力内容をご確認ください。";
}

// 匿名の登録/ログイン。メール+パスワードで Supabase Auth を使う。
// ヘッダーの「ログイン」「新規登録」から ?mode= で初期タブが決まる。
function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = params.get("mode") === "login" ? "login" : "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [university, setUniversity] = useState("");
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;

    if (mode === "signup" && !username.trim()) {
      setMsg("ユーザーネームを入力してください");
      return;
    }

    setLoading(true);
    setMsg(null);
    const supabase = createBrowserSupabase();

    if (mode === "signup") {
      // ユーザーネームの重複を事前チェック（登録前に弾く）。
      try {
        const r = await fetch(
          `/api/username-available?name=${encodeURIComponent(username.trim())}`
        );
        const j = await r.json();
        if (!j.available) {
          setLoading(false);
          setMsg("このユーザーネームは既に使われています。別の名前にしてください。");
          return;
        }
      } catch {
        // チェックに失敗しても登録は続行（サーバー側の一意制約が最終防衛）。
      }

      // 公開ユーザーネーム・大学名は user_metadata に保存し、
      // 初回の User 作成時（サーバー側 getCurrentUser）に反映する。
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            university: university.trim() || null,
          },
        },
      });
      setLoading(false);
      if (error) {
        setMsg(translateAuthError(error));
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
      setMsg(translateAuthError(error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  // Google / Apple でログイン/登録。戻り先 /auth/callback → /onboarding（未設定なら名前入力）。
  async function oauth(provider: "google" | "apple") {
    setMsg(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    if (error) setMsg(translateAuthError(error));
  }

  return (
    <div>
      <h1>{mode === "signup" ? "新規登録" : "ログイン"}</h1>
      <p className="muted">メールアドレスは本人確認・通知にのみ使用します（匿名で利用できます）。</p>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label>ユーザーネーム（全員に公開されます）</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例: がんばるカワウソ"
              maxLength={30}
              autoComplete="nickname"
            />
            <label>大学名（任意）</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="例: 〇〇大学"
              maxLength={60}
            />
          </>
        )}

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

      <div
        className="muted"
        style={{ textAlign: "center", margin: "16px 0 8px", fontSize: "0.85rem" }}
      >
        ── または ──
      </div>
      <button
        type="button"
        onClick={() => oauth("google")}
        className="btn-secondary"
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          Google で続ける
        </span>
      </button>
      <button
        type="button"
        onClick={() => oauth("apple")}
        style={{ background: "#000", color: "#fff", boxShadow: "none", marginTop: 10 }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg
            width="16"
            height="18"
            viewBox="0 0 384 512"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
          </svg>
          Apple でサインイン
        </span>
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

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="muted">読み込み中...</p>}>
      <AuthForm />
    </Suspense>
  );
}
