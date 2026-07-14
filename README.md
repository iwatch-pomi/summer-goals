# ススメ — 参考書ランキング 📖🏆

**参考書・教科書の進捗を報告して、みんなと競い合う学習サービス。**

対象は**受験期の高校生**や、**TOEIC・資格・専門科目に取り組む大学生**。
取り組む参考書を登録し、毎日**進めたページ数**を報告。**週間ページ数ランキング**と
**連続報告日数（ストリーク）**でみんなと競い合い、気になる人を**応援（エール）**できる。完全無料。

## ドキュメント

- 📐 **設計図**: [`docs/DESIGN.md`](docs/DESIGN.md)
- 🛠️ **セットアップ手順（非エンジニア向け）**: [`docs/SETUP.md`](docs/SETUP.md)

> ※ `docs/` は旧・課金/マッチングモデルの記述が残っています（コードは撤去済み）。参照時は本 README を優先してください。

## 技術スタック

Next.js 14 (App Router) + TypeScript / Prisma + PostgreSQL(Supabase) / Supabase Auth & Storage / Vercel(Cron) / PWA

## プロジェクト構成

```
prisma/schema.prisma          # データモデル（Goal=参考書 / Report=日々の進捗ページ数 / Cheer=応援）
src/lib/                       # サービス層
  prisma.ts supabase.ts auth.ts dates.ts
  streak.ts                    # ストリーク・週集計
  ranking.ts                   # 週間ページ数 / 連続日数ランキング算出
  subjects.ts                  # 科目タグのラベル
  cheers.ts account.ts cron.ts legal.ts
src/app/                       # 画面
  page.tsx signup/ onboarding/ dashboard/ goals/new/ report/
  feed/                        # みんなの進捗タイムライン
  ranking/                     # ランキング（週間ページ数 / 連続日数・科目フィルタ）
  u/[name]/                    # 共有プロフィール
src/app/api/                   # API ルート
  goals reports cheers profile username-available
  account/deactivate account/reactivate cron/purge-accounts
public/                        # PWA: manifest.json, sw.js, icons/
vercel.json                    # Cron 設定
```

## ローカル開発（開発者向け）

```bash
npm install
cp .env.example .env.local      # 値を埋める（docs/SETUP.md 参照）
npx prisma migrate dev          # マイグレーション適用
npm run dev                     # http://localhost:3000
```

## 状態

これは **実働スキャフォールド** です。構造・型・主要ロジックは実装済みですが、
本番稼働には Supabase / Vercel のアカウントと環境変数の設定が必要です。
PWA アイコン（`public/icons/`）の差し替えも必要です。
