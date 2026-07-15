# ススメ（参考書ランキング）— 設計図

参考書・教科書の進捗（ページ数）を報告し、**週間ページ数ランキング**と**連続報告日数（ストリーク）**でみんなと競い合う学習サービス。対象は受験期の高校生、TOEIC・資格・専門科目に取り組む大学生。**完全無料**（決済なし）。

## コンセプト

1. 取り組む参考書・教科書を**登録**する（科目タグ・総ページ数は任意）。
2. 毎日、進めた**ページ数**を報告する（写真・ボタン・タイマーの3方式から選べる）。
3. **週間ページ数ランキング**・**連続報告日数ランキング**でみんなと競い合う。
4. 気になる人の宣言・進捗に**応援（エール）**を送れる。
5. 公開プロフィール（`/u/[name]`）を SNS に貼って外部からの視線も得られる。

## 技術スタック

| 領域 | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript | フロント/バックを1コードベースで。PWA 対応が容易 |
| DB / ORM | PostgreSQL + Prisma | 型安全・マイグレーション容易 |
| 認証 | Supabase Auth | 自前実装を避け短期ローンチを優先 |
| ストレージ | Supabase Storage | 進捗写真の保存（非公開バケット＋署名URL） |
| バッチ | Vercel Cron | 退会アカウントの完全削除を日次実行 |
| ホスティング | Vercel | Next.js と親和性が高い |

タイムゾーンは **JST 固定**（`src/lib/dates.ts` がサーバーの実行TZに依存せずJSTの暦日を扱う）。

---

## 1. データベース設計

実装は [`prisma/schema.prisma`](../prisma/schema.prisma) を正とする。以下は概要。

### enum

- `GoalGenre`（科目タグ）: `ENGLISH` / `MATH` / `JAPANESE` / `SCIENCE` / `SOCIAL` / `TOEIC` / `QUALIFICATION` / `MAJOR` / `OTHER`
- `GoalStatus`: `ACTIVE`（進行中）/ `COMPLETED`（期間満了）/ `CANCELLED`（取消・退会）/ `MATCHING`（旧・未使用。互換のため残置）
- `ReportMethod`（日々の報告方法）: `PHOTO`（写真提出）/ `BUTTON`（ワンタップ）/ `TIMER`（アプリ内タイマーで規定時間）

### User（利用者）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| email | string (unique) | Supabase Auth と email で1:1対応 |
| displayName | string (unique) | 公開ユーザーネーム（共有プロフィールのURLにも使う）|
| university | string? | 大学名（任意・公開）|
| profileComplete | boolean | ユーザーネーム設定済みか（Google初回は false→onboarding）|
| avatarSeed | string | アバター生成用シード（Supabase Authのuser idも保持し、退会時の削除に使用）|
| timezone | string | 既定 "Asia/Tokyo" |
| status | string | 既定 "ACTIVE"（`PENDING_DELETION` で退会猶予中）|
| deletionScheduledAt | datetime? | 退会申請時に now+7日 |
| createdAt / updatedAt | datetime | |

### Goal（参考書・教科書＝取り組み）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK→User) | |
| genre | GoalGenre? | 科目タグ（任意）|
| title | string | 参考書名。例「システム英単語」|
| description | string? | 詳細・目標（任意）|
| totalPages | int? | 総ページ数（任意・進捗バー用）|
| reportMethod | ReportMethod | 既定 PHOTO |
| studyMinutes | int? | TIMER方式のときの規定勉強分数 |
| isPublic | boolean | 既定 true（公開タイムライン・ランキングに反映）|
| dailyDeadline | string | 既定 "23:59"（JST）|
| periodStart / periodEnd | date | 取り組み期間 |
| status | GoalStatus | 既定 ACTIVE |
| createdAt | datetime | |

- `@@index([isPublic, createdAt])` … 公開タイムライン抽出用。
- 同一科目で複数の参考書を並行登録できる（制限なし）。

### Report（毎日の進捗報告）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| userId / goalId | uuid (FK) | |
| reportDate | date | 対象日（JST）|
| textContent | string | メモ（任意。未入力は空文字）|
| pagesRead | int? | その日進めたページ数。**ランキングの基礎** |
| photoUrl | string? | Supabase Storage（非公開バケット）上のパス。表示時に署名URLを発行 |
| studiedSeconds | int? | TIMER方式で集中した秒数 |
| createdAt | datetime | |

- `@@unique([goalId, reportDate])` … **1目標1日1報告**。冪等性の核。
- 「報告有無」= その日に行が存在するか。「連続報告日数」= `src/lib/streak.ts` の `computeStreak`。

### Cheer（応援・エール）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK→User) | 応援した人 |
| goalId | uuid? (FK→Goal) | 宣言への応援（`goalId`/`reportId`はどちらか一方）|
| reportId | uuid? (FK→Report) | 進捗への応援 |
| createdAt | datetime | |

- `@@unique([userId, goalId])` / `@@unique([userId, reportId])` … 二重応援不可。

### リレーション概要

```
User 1─N Goal 1─N Report
User 1─N Cheer ─(goalId?/reportId?)─ Goal / Report
```

---

## 2. コアロジックの設計

### A. 参考書登録 → 日々の報告

実装: [`src/app/api/goals/route.ts`](../src/app/api/goals/route.ts) / [`src/app/api/reports/route.ts`](../src/app/api/reports/route.ts)

1. **サインアップ**（`/signup`）: Supabase Auth に登録 → 初回アクセス時に `User` を自動作成（[`src/lib/auth.ts`](../src/lib/auth.ts)）。email登録はユーザーネームを直接指定、Google/Apple初回はランダムニックネームを付与し `/onboarding` へ誘導。
2. **参考書登録**（`/goals/new` → `POST /api/goals`）: タイトル・科目・総ページ数・報告方式・取り組み期間を保存し `status=ACTIVE` で作成。
3. **日々の報告**（`/report` → `POST /api/reports`）: 当日（JST）の `Report` を作成。方式ごとのサーバー側バックストップ（PHOTOは写真必須、TIMERは規定秒数到達必須）。写真は service role で非公開バケットへアップロードしパスのみ保存。`pagesRead` は0〜9999の整数で任意入力、週間ランキングの集計対象になる。

### B. ランキング算出

実装: [`src/lib/ranking.ts`](../src/lib/ranking.ts) / [`src/app/ranking/page.tsx`](../src/app/ranking/page.tsx)

1. **週間ページ数ランキング**（`weeklyPageRanking`）: 今週（月曜起点、JST）の `Report.pagesRead` を `userId` ごとに `groupBy` で合計し降順ソート。公開（`isPublic`）な取り組みのみ対象。科目（`genre`）で絞り込み可。
2. **連続報告日数ランキング**（`streakRanking`）: 直近90日分の公開 `Report` を `userId` ごとに集め、[`src/lib/streak.ts`](../src/lib/streak.ts) の `computeStreak` で現在のストリークを算出し降順ソート。
3. `/ranking` ページで `?metric=pages|streak` と `?subject=<GoalGenre>` により表示を切り替え。ログイン中は自分の順位をハイライト。

### C. 応援・タイムライン・公開プロフィール

実装: [`src/app/api/cheers/route.ts`](../src/app/api/cheers/route.ts) / [`src/lib/cheers.ts`](../src/lib/cheers.ts) / [`src/app/feed/page.tsx`](../src/app/feed/page.tsx) / [`src/app/u/[name]/page.tsx`](../src/app/u/[name]/page.tsx)

- `POST /api/cheers` はトグル式（既にあれば削除、無ければ作成）。対象（`goalId` または `reportId` のどちらか一方）は公開のもののみ許可。
- `/feed` は公開の新着参考書・新着進捗を表示するログイン不要のタイムライン。
- `/u/[name]` は SNS 共有向けの公開プロフィール（ストリーク・統計・取り組み中の参考書・進捗一覧）。

### D. 退会（ソフトデリート＋猶予期間）

実装: [`src/lib/account.ts`](../src/lib/account.ts) / [`src/app/api/cron/purge-accounts/route.ts`](../src/app/api/cron/purge-accounts/route.ts)

1. 退会申請（`POST /api/account/deactivate`）: `status=PENDING_DELETION`、`deletionScheduledAt=now+7日`（`GRACE_DAYS`）。
2. 猶予中の取り消し（`POST /api/account/reactivate`）: `status=ACTIVE` に戻す。
3. **日次バッチ**: Vercel Cron が `GET /api/cron/purge-accounts` を叩き（[`src/lib/cron.ts`](../src/lib/cron.ts) の `CRON_SECRET` で保護）、猶予を過ぎたユーザーを完全削除（ストレージの写真 → DB → Supabase Authユーザーの順）。

---

## 3. 画面構成

| ルート | 認証 | 内容 |
|---|---|---|
| `/` | 公開 | ランディング（週間ランキングのプレビュー付き）|
| `/signup` | 公開 | サインアップ / ログイン |
| `/onboarding` | 要ログイン | 初回ユーザーネーム設定 |
| `/dashboard` | 要ログイン | マイページ（ストリーク・進捗フィード・自分の参考書・ランキング/みんなの進捗への導線）|
| `/goals/new` | 要ログイン | 参考書登録フォーム |
| `/report` | 要ログイン | 当日の進捗報告フォーム |
| `/ranking` | 公開 | 週間ページ数・連続報告日数ランキング（科目フィルタ）|
| `/feed` | 公開 | みんなの進捗タイムライン |
| `/u/[name]` | 公開 | 共有プロフィール |
| `/account` | 要ログイン | アカウント設定・退会 |

---

## 補足: 意図的に省いている範囲（今後の課題）

- プッシュ通知（締切前リマインド）→ まずはメール/バナーで代替。
- 通報・ブロック等のモデレーション機能。
- オフライン対応（Service Worker のキャッシュ戦略、現状は最小限のスタブ）。
- 月間・全期間などランキングの追加期間軸（現状は週間ページ数＋連続日数の2軸）。
