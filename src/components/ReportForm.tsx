"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Method = "PHOTO" | "BUTTON" | "TIMER";

// 毎日の進捗報告フォーム（ソロ）。報告方法（写真／ボタン／タイマー）で入力を出し分ける。
// 写真はサーバー(/api/reports)経由で非公開バケットへ安全にアップロードされる。
export default function ReportForm({
  goalId,
  goalTitle,
  method,
  studyMinutes,
}: {
  goalId: string;
  goalTitle: string;
  method: Method;
  studyMinutes: number;
}) {
  const router = useRouter();

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TIMER 用のカウントダウン（アプリ内・正直ベース）。
  const targetSeconds = Math.max(1, Math.round(studyMinutes * 60));
  const [remaining, setRemaining] = useState(targetSeconds);
  const [running, setRunning] = useState(false);
  const timerDone = remaining <= 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  async function submit() {
    setLoading(true);
    setMsg(null);

    // multipart/form-data で送信（Content-Type はブラウザが自動設定）。
    const fd = new FormData();
    fd.append("goalId", goalId);
    fd.append("textContent", text);
    if (file) fd.append("photo", file);
    if (method === "TIMER" && timerDone) {
      fd.append("studiedSeconds", String(targetSeconds));
    }

    const res = await fetch("/api/reports", { method: "POST", body: fd });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.error === "goal-required") {
        router.push("/goals/new?next=/report");
        return;
      }
      setMsg(data?.message ?? "報告に失敗しました");
      return;
    }
    router.push("/dashboard");
  }

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // 送信可否：PHOTO は写真必須、TIMER は完了必須。
  const canSubmit =
    !loading &&
    (method === "PHOTO" ? !!file : true) &&
    (method === "TIMER" ? timerDone : true);

  // 任意のメモ＋写真欄（全方式で表示）。PHOTO は写真が必須。
  const optionalFields = (
    <>
      <label>メモ（任意）</label>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 単語100個 / スクワット50回"
      />
      <label>{method === "PHOTO" ? "証拠写真（5MBまで）" : "写真（任意・5MBまで）"}</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </>
  );

  return (
    <div>
      <h1>今日の進捗報告</h1>
      <p className="muted">
        宣言：<strong>{goalTitle}</strong>
        <br />
        今日の進捗はみんなのタイムラインに公開されます。
      </p>

      {method === "TIMER" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            {studyMinutes}分 勉強すると報告できます
          </p>
          <div
            style={{
              fontSize: "2.6rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              margin: "8px 0",
              color: timerDone ? "var(--green)" : "var(--navy)",
            }}
          >
            {timerDone ? "完了！" : mmss(remaining)}
          </div>
          {!timerDone && (
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className={running ? "btn-secondary" : ""}
            >
              {running ? "一時停止" : remaining === targetSeconds ? "スタート" : "再開"}
            </button>
          )}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            ※画面を離れるとタイマーは止まります。
          </p>
        </div>
      )}

      {method === "PHOTO" && optionalFields}

      {method === "BUTTON" && (
        <details style={{ margin: "8px 0" }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            メモや写真を追加する（任意）
          </summary>
          <div style={{ marginTop: 8 }}>{optionalFields}</div>
        </details>
      )}

      {method === "TIMER" && (
        <details style={{ margin: "8px 0" }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            メモや写真を追加する（任意）
          </summary>
          <div style={{ marginTop: 8 }}>{optionalFields}</div>
        </details>
      )}

      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={submit} disabled={!canSubmit}>
        {loading
          ? "送信中..."
          : method === "BUTTON"
          ? "今日勉強した！"
          : "報告する"}
      </button>
    </div>
  );
}
