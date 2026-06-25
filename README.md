# Summer Goals 🏃‍♂️🔥

**「ガチ」目標達成マッチングアプリ** — 夏休み限定（8月〜9月）で大学生向けに提供する MVP。

本気で目標を達成したい見知らぬ大学生同士を **匿名でペアリング** し、毎日の進捗報告を義務化。
サボると **¥500** がサボった側から決済され、毎日達成している相方に **デジタルギフト** が自動付与される（ペナルティ奢り合いモデル）。

## ドキュメント

- 📐 **設計図**: [`docs/DESIGN.md`](docs/DESIGN.md) — DB設計・コアロジック・開発ロードマップ
- 🛠️ **セットアップ手順（非エンジニア向け）**: [`docs/SETUP.md`](docs/SETUP.md)

## 技術スタック

Next.js 14 (App Router) + TypeScript / Prisma + PostgreSQL(Supabase) / Supabase Auth & Storage / Stripe / Vercel(Cron) / PWA

## プロジェクト構成

```
prisma/schema.prisma          # データモデル（DB設計の正）
src/lib/                       # サービス層
  prisma.ts  stripe.ts  supabase.ts  auth.ts  dates.ts
  matching.ts                  # マッチングロジック
  penalty.ts                   # 日次バッチ（サボり判定→決済→ギフト）
  gift.ts                      # ギフト発行アダプタ（manual / giftee）
src/app/                       # 画面
  page.tsx signup/ card/ goals/new/ dashboard/ report/
src/app/api/                   # API ルート
  stripe/setup  stripe/webhook  goals  reports  cron/daily-penalty
public/                        # PWA: manifest.json, sw.js, icons/
vercel.json                    # 日次バッチの Cron 設定（00:10 JST）
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
