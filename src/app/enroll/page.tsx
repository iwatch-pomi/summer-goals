"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

// チャレンジ参加 = ¥3,500 前払いページ。
// 1) /api/challenges/enroll で PaymentIntent の client_secret を取得（即時 Capture）
// 2) Stripe Payment Element をマウント
// 3) confirmPayment で ¥3,500 を決済 → Webhook で paidMember=true / Challenge=ACTIVE
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

export default function EnrollPage() {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/challenges/enroll", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.message ?? "参加手続きの準備に失敗しました。ログイン状態を確認してください。");
        return;
      }
      setAmount(data.amount ?? null);
      const s = await stripePromise;
      if (!s || !mounted) return;
      const e = s.elements({ clientSecret: data.clientSecret });
      const payment = e.create("payment");
      if (elRef.current) payment.mount(elRef.current);
      setStripe(s);
      setElements(e);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit() {
    if (!stripe || !elements) return;
    setLoading(true);
    setMsg(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });
    if (error) {
      setLoading(false);
      setMsg(error.message ?? "決済に失敗しました");
      return;
    }

    // Webhook の到着を待たず、その場でサーバーにアクティベートさせる。
    // これにより決済直後に「返金見込み」画面（参加済みダッシュボード）へ移れる。
    try {
      await fetch("/api/challenges/confirm", { method: "POST" });
    } catch {
      // 失敗しても Webhook が後で反映する。ダッシュボードへは進める。
    }

    router.push("/dashboard");
  }

  return (
    <div>
      <h1>チャレンジに参加する</h1>
      <p className="muted">
        参加には <strong>¥{(amount ?? 3500).toLocaleString()}</strong> を前払いします。
        <br />
        内訳: 参加費 ¥500（返金不可）＋ デポジット ¥3,000（毎日の報告に応じて返金）。
        <br />
        毎日報告すれば <strong>デポジットは全額（¥3,000）返金</strong> されます。サボった日数 × ¥100 が失効します。
      </p>
      <div className="card">
        {!elements && !msg && (
          <p className="muted" style={{ margin: 0 }}>
            決済フォームを読み込み中…（数秒かかることがあります）
          </p>
        )}
        <div ref={elRef} />
      </div>
      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={submit} disabled={loading || !stripe}>
        {loading ? "処理中..." : `¥${(amount ?? 3500).toLocaleString()} を支払って参加`}
      </button>
    </div>
  );
}
