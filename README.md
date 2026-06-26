# Summer Goals 🏃‍♂️🔥

**「ガチ」目標達成マッチングアプリ** — 夏休み限定（8月〜9月）で大学生向けに提供する MVP。

本気で目標を達成したい見知らぬ大学生同士を **匿名でペアリング** し、毎日の進捗報告を義務化。
**デポジット返金モデル**: 8月開始時に **¥3,500 を前払い**（参加費 ¥500【返金不可】＋ デポジット ¥3,000【日割返金可】）。サボると1日 **¥100 が失効**し、月末に **¥100 × 報告成功日数** を Stripe 部分返金。失効分＋参加費が運営利益。

## ドキュメント

- 📐 **設計図**: [`docs/DESIGN.md`](docs/DESIGN.md) — DB設計・コアロジック・開発ロードマップ
- 🛠️ **セットアップ手順（非エンジニア向け）**: [`docs/SETUP.md`](docs/SETUP.md)

## 技術スタック

Next.js 14 (App Router) + TypeScript / Prisma + PostgreSQL(Supabase) / Supabase Auth & Storage / Stripe / Vercel(Cron) / PWA

## プロジェクト構成

```
prisma/schema.prisma          # データモデル（DB設計の正。Challenge=デポジット）
src/lib/                       # サービス層
  prisma.ts  stripe.ts  supabase.ts  auth.ts  dates.ts
  matching.ts                  # マッチングロジック
  settlement.ts                # 月末バッチ（成功日数集計→部分返金）
src/app/                       # 画面
  page.tsx signup/ card/ goals/new/ dashboard/ report/
src/app/api/                   # API ルート
  stripe/setup  stripe/webhook  goals  reports
  challenges/enroll            # ¥3,500 前払い（PaymentIntent 即時 Capture）
  cron/settlement              # 月末の部分返金バッチ
scripts/settle-refunds.ts      # 返金バッチの単体実行スクリプト
public/                        # PWA: manifest.json, sw.js, icons/
vercel.json                    # Cron 設定（00:10 JST。endDate 経過後に精算）
```

## ローカル開発（開発者向け）

```bash
npm install
cp .env.example .env.local      # 値を埋める（docs/SETUP.md 参照）
npx prisma migrate dev --name init
npm run dev                     # http://localhost:3000
```

## 状態

これは **実働スキャフォールド** です。構造・型・主要ロジックは実装済みですが、
本番稼働には Supabase / Stripe / Vercel のアカウントと環境変数の設定が必要です
（[`docs/SETUP.md`](docs/SETUP.md) の手順どおりに進めれば公開できます）。
PWA アイコン（`public/icons/`）の差し替えも必要です。
