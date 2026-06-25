"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createAnonClient, STORAGE_BUCKET } from "@/lib/supabase";

// 毎日の進捗報告フォーム。テキスト + 任意の写真。
function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const matchId = params.get("matchId") ?? "";
  const supabase = createAnonClient();

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);

    let photoUrl: string | null = null;
    if (file) {
      // Supabase Storage にアップロードし公開 URL を取得。
      const path = `${matchId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file);
      if (upErr) {
        setLoading(false);
        setMsg("写真のアップロードに失敗しました: " + upErr.message);
        return;
      }
      photoUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, textContent: text, photoUrl }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.message ?? "報告に失敗しました");
      return;
    }
    router.push("/dashboard");
  }

  if (!matchId) {
    return <p>マッチが指定されていません。</p>;
  }

  return (
    <div>
      <h1>今日の進捗報告</h1>
      <p className="muted">23:59（JST）までに報告すればペナルティはありません。</p>

      <label>今日やったこと</label>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 単語100個 / スクワット50回"
      />

      <label>証拠写真（任意）</label>
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

export default function ReportPage() {
  return (
    <Suspense fallback={<p>読み込み中...</p>}>
      <ReportForm />
    </Suspense>
  );
}
