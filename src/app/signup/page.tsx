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
