"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Google 初回ログインなどでユーザーネーム未設定のときの設定フォーム。
export default function OnboardingForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [university, setUniversity] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    if (!username.trim()) {
      setMsg("ユーザーネームを入力してください");
      return;
    }
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), university: university.trim() }),
    });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg(data?.message ?? "設定に失敗しました");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
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
      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "設定中..." : "はじめる"}
      </button>
    </form>
  );
}
