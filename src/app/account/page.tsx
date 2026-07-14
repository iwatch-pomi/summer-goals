import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { GRACE_DAYS } from "@/lib/account";
import { DeactivateButton, ReactivateButton } from "@/components/AccountButtons";

export const dynamic = "force-dynamic";

// アカウント設定 / 退会。
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <h1>ログインが必要です</h1>
        <Link href="/signup?mode=login" className="btn">
          ログイン
        </Link>
      </div>
    );
  }

  const pending = user.status === "PENDING_DELETION" && user.deletionScheduledAt;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>アカウント</h1>
        <Link href="/dashboard" className="muted">
          ← マイページ
        </Link>
      </div>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>ユーザーネーム</p>
        <p style={{ margin: "4px 0 12px", fontWeight: 700 }}>{user.displayName}</p>
        <p className="muted" style={{ margin: 0 }}>大学名</p>
        <p style={{ margin: "4px 0" }}>{user.university ?? "（未設定）"}</p>
      </div>

      {pending ? (
        <div className="card" style={{ borderColor: "#fca5a5" }}>
          <span className="badge">退会手続き中</span>
          <p style={{ margin: "8px 0" }}>
            <strong>
              {new Date(user.deletionScheduledAt as Date).toLocaleDateString("ja-JP")}
            </strong>{" "}
            にアカウントとすべてのデータが完全に削除されます。
          </p>
          <p className="muted">それまでは取り消せます。</p>
          <ReactivateButton />
        </div>
      ) : (
        <div className="card" style={{ borderColor: "#fca5a5" }}>
          <strong>退会</strong>
          <p className="muted">
            退会すると、{GRACE_DAYS}日間の猶予のあと、目標・報告・写真・部屋を含む
            すべてのデータが完全に削除されます（猶予中は取り消し可能）。
          </p>
          <DeactivateButton />
        </div>
      )}
    </div>
  );
}
