"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECTS } from "@/lib/subjects";

// 科目は任意タグ。「選択しない」を先頭に置く。
const GENRES = [{ value: "", label: "選択しない" }, ...SUBJECTS];

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

function todayJstYmd(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtJp(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 目標（公開宣言）の作成フォーム。作成後は next（既定 /dashboard）へ戻る。
export default function GoalForm({ next }: { next?: string }) {
  const router = useRouter();
  const [genre, setGenre] = useState(""); // 既定は「選択しない」
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalPages, setTotalPages] = useState(""); // 総ページ数（任意）
  const [reportMethod, setReportMethod] = useState<"PHOTO" | "BUTTON" | "TIMER">("PHOTO");
  const [studyMinutes, setStudyMinutes] = useState("30"); // TIMER時の規定分
  // 開始日は今日以降。期間（日数）は既定30日で編集可。終了日は自動確定。
  const minStart = todayJstYmd();
  const [periodStart, setPeriodStart] = useState(minStart);
  const [durationDays, setDurationDays] = useState("30");
  const durNum = Math.max(1, Math.floor(Number(durationDays) || 0));
  const periodEnd = addDaysYmd(periodStart, durNum - 1);
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
        totalPages: totalPages.trim() !== "" ? Number(totalPages) : undefined,
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
      <h1>参考書・教科書を登録する</h1>
      <p className="muted">
        取り組む参考書・教科書を登録します。登録すると<strong>公開プロフィール・タイムライン・ランキング</strong>に反映され、
        日々の進捗ページ数でみんなと競い合えます。
      </p>

      <label>参考書名（タイトル）</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例: システム英単語 / 青チャートIA / TOEIC公式問題集7"
      />

      <label>詳細・目標（任意）</label>
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="例: 夏までに2周する"
      />

      <label>科目（任意）</label>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      <label>総ページ数（任意）</label>
      <input
        type="number"
        min={1}
        max={9999}
        inputMode="numeric"
        value={totalPages}
        onChange={(e) => setTotalPages(e.target.value)}
        placeholder="例: 320"
      />

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
        min={minStart}
        onChange={(e) => setPeriodStart(e.target.value)}
      />
      <label>期間（日数）</label>
      <input
        type="number"
        min={1}
        max={365}
        value={durationDays}
        onChange={(e) => setDurationDays(e.target.value)}
        placeholder="例: 30"
      />
      <p className="muted" style={{ margin: "8px 0 0" }}>
        期間：<strong>{fmtJp(periodStart)} 〜 {fmtJp(periodEnd)}</strong>（{durNum}日間）
      </p>

      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button
        onClick={submit}
        disabled={
          loading ||
          !title ||
          periodStart < minStart ||
          (reportMethod === "TIMER" && !(Number(studyMinutes) >= 1))
        }
      >
        {loading ? "登録中..." : "参考書を登録する"}
      </button>
    </div>
  );
}
