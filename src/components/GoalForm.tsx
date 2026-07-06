"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ジャンルは任意タグ。「選択しない」を先頭に置く。
const GENRES = [
  { value: "", label: "選択しない" },
  { value: "ENGLISH", label: "英語学習" },
  { value: "MUSCLE_TRAINING", label: "筋トレ" },
  { value: "STUDY", label: "勉強・資格" },
  { value: "READING", label: "読書" },
  { value: "DIET", label: "ダイエット" },
  { value: "OTHER", label: "その他" },
];

// 日々の報告方法（目標登録時に選ぶ）。
const METHODS = [
  { value: "PHOTO", label: "写真で報告", desc: "毎日、勉強の証拠写真を提出して報告します。" },
  { value: "BUTTON", label: "ボタンで報告", desc: "「今日勉強した」ボタンを押すだけで報告完了。" },
  {
    value: "TIMER",
    label: "タイマーで報告",
    desc: "アプリ内タイマーで決めた時間を勉強すると報告できます。",
  },
] as const;

// 目標作成フォーム（個人・ソロ）。作成後は next（既定 /dashboard）へ戻る。
// マッチングや部屋の作成には一切連動しない。
export default function GoalForm({ next }: { next?: string }) {
  const router = useRouter();
  const [genre, setGenre] = useState(""); // 既定は「選択しない」
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportMethod, setReportMethod] = useState<"PHOTO" | "BUTTON" | "TIMER">("PHOTO");
  const [studyMinutes, setStudyMinutes] = useState("30"); // TIMER時の規定分
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
      body: JSON.stringify({
        genre: genre || undefined, // 空文字は送らない（任意）
        title,
        description,
        reportMethod,
        studyMinutes: reportMethod === "TIMER" ? Number(studyMinutes) : undefined,
        periodStart,
        periodEnd,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg(data?.message ?? "作成に失敗しました");
      return;
    }
    router.push(next || "/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1>目標を設定</h1>
      <p className="muted">
        あなた自身の目標です。毎日の報告でデポジットが返金されます。部屋への参加は任意です。
      </p>

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

      <label>ジャンル（任意）</label>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      <label>報告方法</label>
      <div style={{ display: "grid", gap: 8 }}>
        {METHODS.map((m) => {
          const selected = reportMethod === m.value;
          return (
            <label
              key={m.value}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                margin: 0,
                padding: "12px 14px",
                border: `1px solid ${selected ? "var(--teal)" : "var(--border)"}`,
                borderRadius: 12,
                background: selected ? "rgba(20,184,166,0.06)" : "#fff",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="reportMethod"
                value={m.value}
                checked={selected}
                onChange={() => setReportMethod(m.value)}
                style={{ width: "auto", marginTop: 3 }}
              />
              <span>
                <strong style={{ color: "var(--navy)" }}>{m.label}</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                  {m.desc}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {reportMethod === "TIMER" && (
        <>
          <label>勉強時間（分）</label>
          <input
            type="number"
            min={1}
            max={600}
            value={studyMinutes}
            onChange={(e) => setStudyMinutes(e.target.value)}
            placeholder="例: 30"
          />
        </>
      )}

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
      <button
        onClick={submit}
        disabled={
          loading ||
          !title ||
          (reportMethod === "TIMER" && !(Number(studyMinutes) >= 1))
        }
      >
        {loading ? "作成中..." : "目標を作成"}
      </button>
    </div>
  );
}
