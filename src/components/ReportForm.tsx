"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 毎日の進捗報告フォーム（ソロ）。テキスト + 任意の写真。
// 写真はサーバー(/api/reports)経由で非公開バケットへ安全にアップロードされる。
export default function ReportForm() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);

    // multipart/form-data で送信（Content-Type はブラウザが自動設定）。
    const fd = new FormData();
    fd.append("textContent", text);
    if (file) fd.append("photo", file);

    const res = await fetch("/api/reports", { method: "POST", body: fd });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // 目標未作成なら目標作成へ誘導（バックストップ）。
      if (data?.error === "goal-required") {
        router.push("/goals/new?next=/report");
        return;
      }
      setMsg(data?.message ?? "報告に失敗しました");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div>
      <h1>今日の進捗報告</h1>
      <p className="muted">23:59（JST）までに報告すればデポジットは失効しません。</p>

      <label>今日やったこと</label>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 単語100個 / スクワット50回"
      />

      <label>証拠写真（任意・5MBまで）</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={submit} disabled={loading || !text}>
        {loading ? "送信中..." : "報告する"}
      </button>
    </div>
  );
}
