"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

// チャレンジ参加 = ¥3,500 前払いページ（2ステップ）。
// Step1: 開始日を選ぶ（8/12〜9/10・30日間固定）。その期間の土日数を「お休みOK日数」として表示。
// Step2: /api/challenges/enroll で PaymentIntent を作成し、Stripe Payment Element で決済。
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

// サーバーの CHALLENGE_* 既定値に合わせる（実下限は max(下限, 今日)）。
// テスト時は NEXT_PUBLIC_ 変数で前倒し可能（設定＋再デプロイが必要）。
const DURATION_DAYS = Number(
  process.env.NEXT_PUBLIC_CHALLENGE_DURATION_DAYS ?? 30
);
const MIN_START =
  process.env.NEXT_PUBLIC_CHALLENGE_MIN_START_DATE ?? "2026-08-12";
const MAX_START =
  process.env.NEXT_PUBLIC_CHALLENGE_MAX_START_DATE ?? "2026-09-10";

// --- 日付ユーティリティ（サーバー lib/dates と同じ計算をクライアントでも行う）---
function todayJstYmd(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function countWeekendDays(startYmd: string, days: number): number {
  const start = new Date(`${startYmd}T00:00:00.000Z`);
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) count += 1;
  }
  return count;
}
function fmtJp(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function EnrollPage() {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);

  const minStart = MIN_START > todayJstYmd() ? MIN_START : todayJstYmd();

  const [step, setStep] = useState<"date" | "pay">("date");
  const [startDate, setStartDate] = useState(minStart);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 選択中の期間・お休みOK日数（プレビュー）。
  const endDate = addDaysYmd(startDate, DURATION_DAYS - 1);
  const graceDays = countWeekendDays(startDate, DURATION_DAYS);

  // Stripe.js は先に読み込んでおく。
  useEffect(() => {
    stripePromise.then((s) => setStripe(s));
  }, []);

  // Step2 に入り clientSecret が揃ったら Payment Element をマウント。
  useEffect(() => {
    if (step !== "pay" || !clientSecret || !stripe || elements) return;
    const e = stripe.elements({ clientSecret });
    const payment = e.create("payment");
    if (elRef.current) payment.mount(elRef.current);
    setElements(e);
  }, [step, clientSecret, stripe, elements]);

  // Step1 → Step2: 開始日を送って PaymentIntent を作成。
  async function goToPayment() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/challenges/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate }),
    });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg(data?.message ?? "参加手続きの準備に失敗しました。");
      return;
    }
    setAmount(data.amount ?? null);
    setClientSecret(data.clientSecret ?? null);
    setStep("pay");
  }

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
    try {
      await fetch("/api/challenges/confirm", { method: "POST" });
    } catch {
      // 失敗しても Webhook が後で反映する。ダッシュボードへは進める。
    }

    router.push("/dashboard");
  }

  // ---- Step1: 開始日の選択 ----
  if (step === "date") {
    return (
      <div>
        <h1>チャレンジに参加する</h1>
        <p className="muted">
          開始日を選んでください。<strong>開始日から30日間</strong>がチャレンジ期間です。
        </p>

        <label>開始日（{fmtJp(MIN_START)}〜{fmtJp(MAX_START)}）</label>
        <input
          type="date"
          value={startDate}
          min={minStart}
          max={MAX_START}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            期間：<strong>{fmtJp(startDate)} 〜 {fmtJp(endDate)}</strong>（30日間）
          </p>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            この期間の土日は <strong>{graceDays} 日</strong>。
            <strong>{graceDays}日まではお休みしても返金は減りません</strong>
            （報告できない日が{graceDays}日以内なら、デポジットは全額戻ります）。
          </p>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          参加には <strong>¥3,500</strong> を前払いします（参加費 ¥500＋デポジット ¥3,000）。
          毎日報告すればデポジットは全額返金。サボった日数 × ¥100 が失効します。
        </p>

        {msg && <p style={{ color: "#dc2626" }}>{msg}</p>}
        <button onClick={goToPayment} disabled={loading}>
          {loading ? "準備中..." : "次へ（お支払い）"}
        </button>
      </div>
    );
  }

  // ---- Step2: 決済 ----
  return (
    <div>
      <h1>お支払い</h1>
      <p className="muted">
        期間：<strong>{fmtJp(startDate)} 〜 {fmtJp(endDate)}</strong>（30日間）／
        お休みOK <strong>{graceDays}日</strong>
        <br />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: "auto", margin: "8px 0 0", padding: "6px 14px", fontSize: "0.85rem" }}
          onClick={() => {
            // 日付を選び直す（次へでサーバー側の日付も更新される）。
            setStep("date");
            setElements(null);
            setClientSecret(null);
          }}
        >
          ← 開始日を選び直す
        </button>
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
