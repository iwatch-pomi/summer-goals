"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

// カード登録ページ。
// 1) /api/stripe/setup で SetupIntent の client_secret を取得
// 2) Stripe Payment Element をマウント
// 3) confirmSetup でカードを保存（Webhook で cardRegistered=true になる）
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

export default function CardPage() {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/stripe/setup", { method: "POST" });
      if (!res.ok) {
        setMsg("カード登録の準備に失敗しました。ログイン状態を確認してください。");
        return;
      }
      const { clientSecret } = await res.json();
      const s = await stripePromise;
      if (!s || !mounted) return;
      const e = s.elements({ clientSecret });
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
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });
    setLoading(false);
    if (error) {
      setMsg(error.message ?? "カード登録に失敗しました");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div>
      <h1>カード登録</h1>
      <p className="muted">
        サボったときのペナルティ（¥500）決済にのみ使用します。毎日報告すれば一切課金されません。
      </p>
      <div className="card">
        <div ref={elRef} />
      </div>
      {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
      <button onClick={submit} disabled={loading || !stripe}>
        {loading ? "登録中..." : "カードを登録する"}
      </button>
    </div>
  );
}
