"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 入室/退室ボタン。
export function JoinLeaveButton({
  roomId,
  joined,
}: {
  roomId: string;
  joined: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const action = joined ? "leave" : "join";
    const res = await fetch(`/api/rooms/${roomId}/${action}`, { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => null);
      alert(d?.message ?? "操作に失敗しました");
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={joined ? "btn-secondary" : ""}
      style={{ width: "auto", margin: 0, padding: "8px 16px", fontSize: "0.85rem" }}
    >
      {loading ? "…" : joined ? "退室" : "入室"}
    </button>
  );
}

// 部屋作成フォーム。
const GENRES = [
  { value: "", label: "ジャンルなし" },
  { value: "ENGLISH", label: "英語学習" },
  { value: "MUSCLE_TRAINING", label: "筋トレ" },
  { value: "STUDY", label: "勉強・資格" },
  { value: "READING", label: "読書" },
  { value: "DIET", label: "ダイエット" },
  { value: "OTHER", label: "その他" },
];

export function CreateRoomForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, genre: genre || undefined }),
    });
    setLoading(false);
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg(d?.message ?? "作成に失敗しました");
      return;
    }
    setName("");
    setDescription("");
    setGenre("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}>＋ 部屋を作る</button>
    );
  }

  return (
    <div className="card">
      <strong>部屋を作る</strong>
      <label>部屋名</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例: 朝活英語部屋"
      />
      <label>説明（任意）</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="どんな部屋か一言"
      />
      <label>ジャンル（任意）</label>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={create} disabled={loading || !name}>
        {loading ? "作成中..." : "作成する"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="btn-secondary"
        style={{ marginTop: 8 }}
      >
        キャンセル
      </button>
    </div>
  );
}
