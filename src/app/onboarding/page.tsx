import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

// 初回ユーザーネーム設定（主に Google ログイン勢向け）。
export default async function OnboardingPage() {
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

  // 既に設定済みならダッシュボードへ。
  if (user.profileComplete) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>ようこそ！</h1>
      <p className="muted">
        表示名（ユーザーネーム）を決めましょう。全員に公開されます（本名でなくてOK）。
      </p>
      <div className="card">
        <OnboardingForm />
      </div>
    </div>
  );
}
