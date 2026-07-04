"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 退会申請ボタン（二重確認あり）。
export function DeactivateButton({ hasActiveChallenge }: { hasActiveChallenge: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function deactivate() {
    const warn = hasActiveChallenge
      ? "進行中のチャレンジがあります。退会するとデポジットは返金されません。\n\n本当に退会しますか？（7日以内なら取り消せます）"
      : "退会しますか？7日後にすべてのデータが完全に削除されます。（7日以内なら取り消せます）";
    if (!confirm(warn)) return;

    setLoading(true);
    const res = await fetch("/api/account/deactivate", { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("退会手続きに失敗しました");
  }

  return (
    <button
      onClick={deactivate}
      disabled={loading}
      style={{ background: "#dc2626", boxShadow: "none" }}
    >
      {loading ? "処理中..." : "退会する"}
    </button>
  );
}

// 退会の取り消しボタン。
export function ReactivateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reactivate() {
    setLoading(true);
    const res = await fetch("/api/account/reactivate", { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("取り消しに失敗しました");
  }

  return (
    <button onClick={reactivate} disabled={loading}>
      {loading ? "処理中..." : "退会を取り消す"}
    </button>
  );
}
