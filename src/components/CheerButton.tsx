"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ワンタップ応援（エール）ボタン。楽観的更新でカウント表示。
// 未ログインで押すとログインへ誘導。goalId / reportId のどちらか一方を渡す。
export default function CheerButton({
  goalId,
  reportId,
  initialCount,
  initialCheered,
  loggedIn,
}: {
  goalId?: string;
  reportId?: string;
  initialCount: number;
  initialCheered: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [cheered, setCheered] = useState(initialCheered);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push("/signup?mode=login");
      return;
    }
    if (loading) return;
    setLoading(true);

    // 楽観的更新。
    const prevCheered = cheered;
    const prevCount = count;
    setCheered(!prevCheered);
    setCount(prevCount + (prevCheered ? -1 : 1));

    try {
      const res = await fetch("/api/cheers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalId ? { goalId } : { reportId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCheered(data.cheered);
        setCount(data.count);
      } else {
        // 失敗したら元に戻す。
        setCheered(prevCheered);
        setCount(prevCount);
      }
    } catch {
      setCheered(prevCheered);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={cheered}
      className="cheer-btn"
      data-cheered={cheered ? "1" : "0"}
    >
      <span aria-hidden>🔥</span>
      <span>応援</span>
      <span className="cheer-count">{count}</span>
    </button>
  );
}
