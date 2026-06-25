# Summer Goals — MVP 設計図

「ガチ」目標達成マッチングアプリの要件定義 & 設計図。夏休み限定（8月〜9月）で大学生向けに最短ローンチする MVP を対象とする。

## コンセプト

本気で目標（英語学習・筋トレ等）を達成したい見知らぬ大学生同士を **匿名でペアリング** し、毎日の進捗報告を義務化する。サボると **ペナルティ（¥500）** がサボった側から決済され、毎日達成している相方へ **デジタルギフト（スタバ eGift 等）** が自動付与される。運営はギフト発行のスプレッドで利益を得る（ペナルティ奢り合いモデル）。

## 技術スタック

| 領域 | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript | フロント/バックを1コードベースで。PWA 対応が容易 |
| DB / ORM | PostgreSQL + Prisma | 型安全・マイグレーション容易 |
| 認証 | Supabase Auth | 自前実装を避け1ヶ月ローンチを優先 |
| ストレージ | Supabase Storage | 進捗写真の保存 |
| 決済 | Stripe（SetupIntent + PaymentIntent off_session） | カード保存→後日自動課金が標準機能 |
| 日次バッチ | Vercel Cron | サーバーレスで定期実行 |
| ホスティング | Vercel | Next.js と親和性が高い |

タイムゾーンは **JST 固定**。締切は毎日 23:59（JST）。

---

## 1. データベース設計

実装は [`prisma/schema.prisma`](../prisma/schema.prisma) を正とする。以下は概要。

### enum

- `GoalGenre`: `ENGLISH` / `MUSCLE_TRAINING` / `STUDY` / `READING` / `DIET` / `OTHER`
- `GoalStatus`: `MATCHING`（相手待ち）/ `ACTIVE`（進行中）/ `COMPLETED` / `CANCELLED`
- `MatchStatus`: `ACTIVE` / `ENDED`
- `PenaltyStatus`: `PENDING` / `CHARGED` / `CHARGE_FAILED` / `SKIPPED`
- `GiftStatus`: `NONE` / `PENDING` / `ISSUED` / `FAILED`

### User（利用者）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| email | string (unique) | Supabase Auth と紐付け |
| displayName | string | 匿名ニックネーム（本名禁止）|
| avatarSeed | string | アバター生成用シード |
| stripeCustomerId | string? (unique) | Stripe 顧客ID |
| defaultPaymentMethodId | string? | SetupIntent で保存した支払い方法 |
| cardRegistered | boolean | カード登録完了フラグ（既定 false）|
| timezone | string | 既定 "Asia/Tokyo" |
| status | string | 既定 "ACTIVE"（退会管理用）|
| createdAt / updatedAt | datetime | |

### Goal（目標）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK→User) | |
| genre | GoalGenre | **マッチングのキー** |
| title | string | 例「TOEIC 800点」|
| description | string? | |
| dailyDeadline | string | 既定 "23:59"（JST）|
| periodStart / periodEnd | date | 取り組み期間（例 8/1〜9/30）|
| status | GoalStatus | 既定 MATCHING |
| createdAt | datetime | |

- `@@index([genre, status])` … マッチング探索を高速化。
- 1ユーザー1ジャンル同時1件（API 層で担保）。

### Match（成立ペア）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| genre | GoalGenre | |
| userAId / userBId | uuid (FK→User) | ペアの2人 |
| goalAId / goalBId | uuid (FK→Goal, unique) | 各自の目標（1目標1マッチ）|
| status | MatchStatus | 既定 ACTIVE |
| startedAt | date | 進捗判定の起点（通常は成立翌日）|
| endedAt | date? | |
| createdAt | datetime | |

### Report（毎日の進捗報告）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| matchId | uuid (FK→Match) | |
| userId | uuid (FK→User) | |
| reportDate | date | 対象日（JST）|
| textContent | string | 報告本文 |
| photoUrl | string? | Supabase Storage の URL |
| createdAt | datetime | |

- `@@unique([matchId, userId, reportDate])` … **1日1報告**。冪等性の核。

### Penalty（ペナルティ決済 & ギフト付与）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| matchId | uuid (FK→Match) | |
| reportDate | date | 判定対象日 |
| fromUserId | uuid (FK→User) | サボった側（課金される）|
| toUserId | uuid (FK→User) | 達成した相方（ギフト受領）|
| amount | int | 既定 500（円）|
| stripePaymentIntentId | string? | |
| penaltyStatus | PenaltyStatus | 既定 PENDING |
| giftStatus | GiftStatus | 既定 NONE |
| giftProvider / giftCode | string? | 発行プロバイダと発行コード/URL |
| createdAt | datetime | |

- `@@unique([matchId, fromUserId, reportDate])` … **バッチ二重実行でも二重課金しない** 冪等キー。

### WebhookEvent（Stripe Webhook 冪等処理）

`id`（Stripe event id, PK）/ `type` / `processedAt`。重複 Webhook を弾く。

### リレーション概要

```
User 1─N Goal
User 2─(A/B)─ Match ─(A/B)─2 Goal
Match 1─N Report
Match 1─N Penalty ─(from/to)─2 User
```

---

## 2. コアルート・ロジックの設計

### A. マッチングが成立する流れ

実装: [`src/lib/matching.ts`](../src/lib/matching.ts) / [`src/app/api/goals/route.ts`](../src/app/api/goals/route.ts)

1. **サインアップ**（`/signup`）: Supabase Auth に登録 → 初回アクセス時に `User` を自動作成し匿名ニックネームを付与（[`src/lib/auth.ts`](../src/lib/auth.ts)）。
2. **カード登録（必須ゲート）**（`/card`）: `POST /api/stripe/setup` で Stripe Customer 作成 + SetupIntent 発行 → フロントの Stripe Payment Element でカード保存 → Webhook `setup_intent.succeeded` で `defaultPaymentMethodId` と `cardRegistered=true` を更新。**未登録ユーザーは目標作成不可。**
3. **目標作成**（`/goals/new` → `POST /api/goals`）: `genre` 等を保存し `status=MATCHING` でプールに入る。
4. **マッチング探索**（`tryMatchGoal`）:
   - 同 `genre` ・ `MATCHING` ・自分以外の最古の Goal を1件取得。
   - **トランザクション内**で両 Goal を条件付き `MATCHING→ACTIVE` 更新（`updateMany` の count が 2 でなければ競合とみなし中断）→ `Match` 作成（`startedAt` = 翌日 JST）。
   - 相手不在なら `MATCHING` のまま待機。取りこぼしは Cron の `runMatchingSweep` が回収。
5. **成立後**: ダッシュボード（`/dashboard`）にペア・相手の進捗が表示される。

### B. 23:59 サボり判定 〜 Stripe 決済処理（日次バッチ）

実装: [`src/lib/penalty.ts`](../src/lib/penalty.ts) / [`src/app/api/cron/daily-penalty/route.ts`](../src/app/api/cron/daily-penalty/route.ts)

**起動**: Vercel Cron が **毎日 00:10 JST（= 15:10 UTC）** に `GET /api/cron/daily-penalty` を叩く（`CRON_SECRET` で保護）。締切 23:59 を過ぎた **前日 D** を判定する。

1. `status=ACTIVE` かつ `startedAt <= D` の全 `Match` を、当日 `Report` 付きで取得。
2. 各 Match で A/B 各自の `Report(D)` 有無を確認。
3. 判定分岐:
   - **両者報告済** → ペナルティなし。
   - **片方のみ未報告** → 未報告者 `fromUserId`・報告者 `toUserId` で `Penalty(PENDING)` 作成（ユニーク制約で冪等。既存なら P2002 をスキップ）。
   - **両者未報告** → 受領者不在のため MVP では課金しない。※将来「運営総取り」をオプション化可。
4. **決済**（`chargePenalty`）: Stripe `PaymentIntent` を **off_session / confirm=true**、保存済み支払い方法・`idempotencyKey=penalty_<id>` で作成。
   - 成功 → `CHARGED` + `giftStatus=PENDING`。
   - 失敗 → `CHARGE_FAILED`（再請求/通知のフック）。
5. **ギフト付与**（`issuePenaltyGift` → [`src/lib/gift.ts`](../src/lib/gift.ts)）: `GiftService` アダプタで相方へ eGift 発行 → `ISSUED` + `giftCode` 保存。失敗時 `FAILED`（運営の手動発行キューへ）。MVP の既定プロバイダは `manual`。
6. **冪等性の三重防御**: ① `(matchId, fromUserId, reportDate)` ユニーク制約 ② Stripe `idempotencyKey` ③ `WebhookEvent` 重複排除。→ バッチ再実行・Webhook 重複でも二重課金/二重発行しない。
7. **期間終了**: `D >= periodEnd` の Match を `ENDED` に更新。

---

## 3. フェーズ別開発ロードマップ（4週間）

| 週 | テーマ | 主タスク | 完了条件 |
|---|---|---|---|
| **1週目** | 基盤・認証・カード登録 | Next.js+TS+Prisma 初期化／Supabase(DB+Auth+Storage) 接続／`User`・`Goal` スキーマ／匿名サインアップ／Stripe Customer + SetupIntent + Webhook | 登録→カード保存→`cardRegistered=true` が動く |
| **2週目** | 目標設定 & マッチング | `Match` スキーマ／目標作成 API・UI／マッチングロジック（即時 + Cron スイープ）／ペア成立ダッシュボード | 2アカウントで同ジャンルがペア成立 |
| **3週目** | 毎日の進捗報告 | `Report` スキーマ／テキスト+写真アップロード(Storage)／報告フォーム・履歴・相手の進捗表示／PWA 化(manifest+SW) | 毎日の報告が保存・表示され、スマホにインストール可 |
| **4週目** | ペナルティ決済 & ギフト & リリース | `Penalty` スキーマ／Vercel Cron 日次バッチ／off_session 決済／`GiftService` + eGift 発行／E2E テスト／本番デプロイ | サボり→¥500課金→相方にギフトの一連が通る |

### バッファ / リスク

- **Stripe 本番審査・ギフト API 契約はリードタイムあり** → 1週目に並行申請。
- 両者未報告時の扱い・返金ポリシー・特商法表記・利用規約・プライバシーポリシーは **法務/運営側の対応が必要**（決済を伴うため必須）。
- 未成年（大学生）でのカード登録可否、本人同意の取り方を要確認。

---

## 補足: MVP で意図的に省いた範囲（今後の課題）

- プッシュ通知（締切前リマインド）→ まずはメール/バナーで代替。
- マッチング解除・相方の途中離脱時のハンドリング。
- 通報・ブロック等のモデレーション機能。
- オフライン対応（Service Worker のキャッシュ戦略）。
