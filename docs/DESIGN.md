# Summer Goals — MVP 設計図

「ガチ」目標達成マッチングアプリの要件定義 & 設計図。夏休み限定（8月〜9月）で大学生向けに最短ローンチする MVP を対象とする。

## コンセプト

本気で目標（英語学習・筋トレ等）を達成したい見知らぬ大学生同士を **匿名でペアリング** し、毎日の進捗報告を義務化する。

**マネタイズ = デポジット返金モデル**: 8月開始時にユーザーが **¥3,500 を前払い**（システム参加費 ¥500【返金不可】＋ デポジット ¥3,000【日割返金可】）。30日間、毎日の進捗報告を求め、1日サボるごとにデポジットから **¥100 が失効**。8月末に **¥100 × 報告成功日数**（上限 ¥3,000）を Stripe の Partial Refund で返金する。失効分＋参加費が運営の利益。

## 技術スタック

| 領域 | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript | フロント/バックを1コードベースで。PWA 対応が容易 |
| DB / ORM | PostgreSQL + Prisma | 型安全・マイグレーション容易 |
| 認証 | Supabase Auth | 自前実装を避け1ヶ月ローンチを優先 |
| ストレージ | Supabase Storage | 進捗写真の保存 |
| 決済 | Stripe（PaymentIntent 即時 Capture + Partial Refund） | 前払い→月末に部分返金が標準機能 |
| バッチ | Vercel Cron | サーバーレスで定期実行 |
| ホスティング | Vercel | Next.js と親和性が高い |

タイムゾーンは **JST 固定**。締切は毎日 23:59（JST）。

> **重要な決済設計**:
> - **JPY はゼロ桁通貨** → Stripe の `amount` は円そのまま（`3500` = ¥3,500）。
> - **必ず即時 Capture** → オーソリ保留は約7日で失効し30日保持できない。前払いで即キャプチャし、月末に `refunds.create` で部分返金する。

---

## 1. データベース設計

実装は [`prisma/schema.prisma`](../prisma/schema.prisma) を正とする。以下は概要。

### enum

- `GoalGenre`: `ENGLISH` / `MUSCLE_TRAINING` / `STUDY` / `READING` / `DIET` / `OTHER`
- `GoalStatus`: `MATCHING`（相手待ち）/ `ACTIVE`（進行中）/ `COMPLETED` / `CANCELLED`
- `MatchStatus`: `ACTIVE` / `ENDED`
- `ChallengePaymentStatus`: `PENDING` / `PAID` / `FAILED`
- `ChallengeStatus`: `AWAITING_PAYMENT` / `ACTIVE` / `SETTLED` / `CANCELLED`
- `SettlementStatus`: `PENDING` / `REFUNDED` / `NO_REFUND` / `REFUND_FAILED`

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
| paidMember | boolean | ¥3,500 決済成功で有料会員（既定 false）|
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
| challengeId | uuid? (FK→Challenge) | 成功日数カウントを Challenge に直結 |
| reportDate | date | 対象日（JST）|
| textContent | string | 報告本文 |
| photoUrl | string? | Supabase Storage の URL |
| createdAt | datetime | 報告タイムスタンプ（JST）|

- `@@unique([matchId, userId, reportDate])` … **1日1報告**。冪等性の核。
- 「報告有無のフラグ」= その日に行が存在するか。「成功日数」= 期間内の `COUNT(DISTINCT reportDate)`。

### Challenge（デポジット = 決済・返金の管理単位）

ユーザー1人の1チャレンジ（8月）= 1レコード。Stripe の Charge/PaymentIntent と返金計算をここに集約する。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK→User) | |
| startDate / endDate | date | 取り組み期間（例 8/1〜8/30）|
| durationDays | int | 既定 30 |
| systemFeeYen | int | 既定 500（返金不可・参加費）|
| depositYen | int | 既定 3000（日割返金可・返金上限）|
| totalChargedYen | int | 既定 3500（前払い総額）|
| dailyForfeitYen | int | 既定 100（サボり1日の失効額）|
| stripePaymentIntentId | string? (unique) | 前払いの PaymentIntent |
| stripeChargeId | string? | latest_charge。**返金時に使用**|
| paymentStatus | ChallengePaymentStatus | 既定 PENDING |
| paidAt | datetime? | |
| successDays | int | 報告成功日数（精算時に確定）|
| refundAmountYen | int | = min(successDays×100, depositYen)|
| forfeitedYen | int | = depositYen − refundAmountYen |
| stripeRefundId | string? | |
| settlementStatus | SettlementStatus | 既定 PENDING |
| settledAt | datetime? | |
| status | ChallengeStatus | 既定 AWAITING_PAYMENT |
| createdAt / updatedAt | datetime | |

- `@@unique([stripePaymentIntentId])` と `idempotencyKey=refund_<id>` で **二重返金を防止**。
- `@@index([status, settlementStatus])` … 月末バッチの抽出用。

### WebhookEvent（Stripe Webhook 冪等処理）

`id`（Stripe event id, PK）/ `type` / `processedAt`。重複 Webhook を弾く。

### リレーション概要

```
User 1─N Goal
User 2─(A/B)─ Match ─(A/B)─2 Goal
User 1─N Challenge        （個人ごとのデポジット）
Match 1─N Report ─N─1 Challenge
```

---

## 2. コアルート・ロジックの設計

### A. マッチングが成立する流れ

実装: [`src/lib/matching.ts`](../src/lib/matching.ts) / [`src/app/api/goals/route.ts`](../src/app/api/goals/route.ts)

1. **サインアップ**（`/signup`）: Supabase Auth に登録 → 初回アクセス時に `User` を自動作成し匿名ニックネームを付与（[`src/lib/auth.ts`](../src/lib/auth.ts)）。
2. **参加 + ¥3,500 前払い**（`POST /api/challenges/enroll`）: Stripe Customer 確保 → `Challenge(AWAITING_PAYMENT)` 作成 → ¥3,500 の PaymentIntent（即時 Capture）→ フロントの Payment Element で confirm → 決済成功（フロー B）で有料会員化。
3. **目標作成**（`/goals/new` → `POST /api/goals`）: `genre` 等を保存し `status=MATCHING` でプールに入る。
4. **マッチング探索**（`tryMatchGoal`）:
   - 同 `genre` ・ `MATCHING` ・自分以外の最古の Goal を1件取得。
   - **トランザクション内**で両 Goal を条件付き `MATCHING→ACTIVE` 更新（`updateMany` の count が 2 でなければ競合とみなし中断）→ `Match` 作成（`startedAt` = 翌日 JST）。
   - 相手不在なら `MATCHING` のまま待機。取りこぼしは Cron の `runMatchingSweep` が回収。
5. **成立後**: ダッシュボード（`/dashboard`）にペア・相手の進捗が表示される。

### B. 決済 → 会員アクティブ化（Webhook）

実装: [`src/app/api/stripe/webhook/route.ts`](../src/app/api/stripe/webhook/route.ts)

1. 署名検証 → `WebhookEvent` で冪等チェック（重複は即 200）。
2. `payment_intent.succeeded`（`metadata.kind=enrollment`）: `latest_charge` を `Challenge.stripeChargeId` に保存し、`Challenge` を `PAID/ACTIVE`、`User.paidMember=true` に更新。
3. `payment_intent.payment_failed`: `Challenge.paymentStatus=FAILED`。

### C. 8月末の部分返金（精算バッチ）

実装: [`src/lib/settlement.ts`](../src/lib/settlement.ts) / [`src/app/api/cron/settlement/route.ts`](../src/app/api/cron/settlement/route.ts) / [`scripts/settle-refunds.ts`](../scripts/settle-refunds.ts)

**起動**: Vercel Cron が **毎日 00:10 JST（= 15:10 UTC）** に `GET /api/cron/settlement` を叩く（`CRON_SECRET` で保護）。`endDate` を過ぎた `ACTIVE` チャレンジだけが対象になるため、実質「8月末に1回」精算される。

対象: `status=ACTIVE` ∧ `settlementStatus=PENDING` ∧ `paymentStatus=PAID` ∧ `endDate <= 今日`。

1. **成功日数**: 期間内の `COUNT(DISTINCT reportDate)` を集計。
2. **返金額**: `refundAmount = min(successDays × 100, depositYen=3000)`、`forfeited = 3000 − refundAmount`。
3. **返金実行**: `refundAmount > 0` なら `stripe.refunds.create({ payment_intent, amount })` を `idempotencyKey=refund_<challengeId>` で実行 → `REFUDED`。`0` なら Stripe が拒否するため呼ばず `NO_REFUND`。
4. **確定**: `successDays / refundAmountYen / forfeitedYen / stripeRefundId` を保存し `status=SETTLED`。失敗時は `REFUND_FAILED`（idempotencyKey により再実行しても二重返金なし）。
5. **冪等性の三重防御**: ① `Challenge.stripePaymentIntentId` の unique ② Stripe `idempotencyKey` ③ `WebhookEvent` 重複排除。

**Vercel Hobby（60秒上限）対応のページング**: `runSettlement(now, { limit, timeBudgetMs })` が1回の呼び出しを「最大 `SETTLEMENT_PAGE_SIZE` 件＋約50秒」で打ち切る。処理済みは `settlementStatus` が `PENDING` から外れるため、残りは翌日以降の Cron が続きから処理する（オフセット不要・重複なし。`hasMore` で残有無を返却）。手動の `scripts/settle-refunds.ts`（`npm run settle`）は時間無制限で全ページをループし、その場で全件精算する。

---

## 3. フェーズ別開発ロードマップ（4週間）

| 週 | テーマ | 主タスク | 完了条件 |
|---|---|---|---|
| **1週目** | 基盤・認証・カード登録 | Next.js+TS+Prisma 初期化／Supabase(DB+Auth+Storage) 接続／`User`・`Goal` スキーマ／匿名サインアップ／Stripe Customer + SetupIntent + Webhook | 登録→カード保存→`cardRegistered=true` が動く |
| **2週目** | 目標設定 & マッチング | `Match` スキーマ／目標作成 API・UI／マッチングロジック（即時 + Cron スイープ）／ペア成立ダッシュボード | 2アカウントで同ジャンルがペア成立 |
| **3週目** | 毎日の進捗報告 | `Report` スキーマ／テキスト+写真アップロード(Storage)／報告フォーム・履歴・相手の進捗表示／PWA 化(manifest+SW) | 毎日の報告が保存・表示され、スマホにインストール可 |
| **4週目** | デポジット決済 & 返金 & リリース | `Challenge` スキーマ／¥3,500 前払い(enroll)／Webhook で会員化／月末の Partial Refund バッチ／E2E テスト／本番デプロイ | 前払い→報告日数に応じた部分返金の一連が通る |

### バッファ / リスク

- **Stripe 本番審査はリードタイムあり** → 1週目に並行申請。
- 両者未報告時の扱い・返金ポリシー・特商法表記・利用規約・プライバシーポリシーは **法務/運営側の対応が必要**（決済を伴うため必須）。
- 未成年（大学生）でのカード登録可否、本人同意の取り方を要確認。

---

## 補足: MVP で意図的に省いた範囲（今後の課題）

- プッシュ通知（締切前リマインド）→ まずはメール/バナーで代替。
- マッチング解除・相方の途中離脱時のハンドリング。
- 通報・ブロック等のモデレーション機能。
- オフライン対応（Service Worker のキャッシュ戦略）。
