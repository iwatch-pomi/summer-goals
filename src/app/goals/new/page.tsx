"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = [
  { value: "ENGLISH", label: "英語学習" },
  { value: "MUSCLE_TRAINING", label: "筋トレ" },
  { value: "STUDY", label: "勉強・資格" },
  { value: "READING", label: "読書" },
  { value: "DIET", label: "ダイエット" },
  { value: "OTHER", label: "その他" },
];

// 目標作成フォーム。作成すると即時マッチングを試行する。
export default function NewGoalPage() {
  const router = useRouter();
  const [genre, setGenre] = useState("ENGLISH");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // 夏休み期間の既定値。
  const [periodStart, setPeriodStart] = useState("2026-08-12");
  const [periodEnd, setPeriodEnd] = useState("2026-09-30");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre, title, description, periodStart, periodEnd }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.message ?? "作成に失敗しました");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div>
      <h1>目標を設定</h1>
      <p className="muted">同じジャンルの大学生とマッチングします。</p>

      <label>ジャンル</label>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      <label>目標（タイトル）</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例: TOEIC 800点 / 毎日腕立て50回"
      />

      <label>詳細（任意）</label>
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label>開始日</label>
      <input
        type="date"
        value={periodStart}
        onChange={(e) => setPeriodStart(e.target.value)}
      />
      <label>終了日</label>
      <input
        type="date"
        value={periodEnd}
        onChange={(e) => setPeriodEnd(e.target.value)}
      />

      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={submit} disabled={loading || !title}>
        {loading ? "作成中..." : "目標を作成してマッチング"}
      </button>
    </div>
  );
}
