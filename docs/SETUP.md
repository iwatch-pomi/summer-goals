# セットアップ手順（プログラミング不要）

このアプリを動かすには、3つの外部サービス（**Supabase / Stripe / Vercel**）に無料登録し、
鍵（キー）をコピーして貼り付けるだけです。順番にやれば1〜2時間で本番公開まで届きます。

> 用語: 「環境変数」= サービスのパスワードや鍵をアプリに教えるための設定値。
> Vercel の管理画面に貼り付けるだけで、ファイルを編集する必要はありません。

---

## 全体の流れ

1. Supabase でデータベース・ログイン・画像保管を用意する
2. Stripe で決済を用意する
3. GitHub のこのリポジトリを Vercel に接続して公開する
4. 環境変数（鍵）を Vercel に貼り付ける
5. テストモードで動作確認 → 問題なければ本番モードへ

---

## 1. Supabase（データベース + ログイン + 画像保管）

1. https://supabase.com にアクセスし「Start your project」でアカウント作成（GitHub ログイン可）。
2. 「New project」を作成。リージョンは **Tokyo (Northeast Asia)** を推奨。データベースのパスワードはメモしておく。
3. 画面上部の緑色の **「Connect」ボタン** を押す（旧 Project Settings → Database の場所から移動しました）:
   - 「ORMs」→「Prisma」タブを選ぶと、`DATABASE_URL`（プール接続 6543）と `DIRECT_URL`（直接接続 5432）の2つが表示される。両方コピー。
   - `[YOUR-PASSWORD]` の部分を 2 で決めたパスワードに置き換える。
   - ※Vercel などサーバーレスでは接続が枯渇しやすいため、実行時はプール接続(6543)、マイグレーションは直接接続(5432)を使い分けます（コードは対応済み）。
4. 左メニュー **Project Settings → API** を開く:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY`（**秘密。絶対に公開しない**）
5. 左メニュー **Storage** で「New bucket」→ 名前を `reports`・**Public は OFF（非公開）** で作成（進捗写真の保管先）。
   - 推奨: Restrict file size = 5MB、Restrict MIME types = `image/*`。
   - **権限ポリシーの追加は不要**（アップロードはサーバーが service_role キーで行い、表示は署名付きURLを発行するため）。
   - バケット名を `SUPABASE_STORAGE_BUCKET` に設定（既定は `reports`）。
6. 左メニュー **Authentication → Providers** で「Email」が有効になっていることを確認。
7. **動作確認を急ぐ場合（推奨）**: Authentication → Providers → Email →「**Confirm email**」を **OFF** にする。
   こうすると新規登録した瞬間にログイン状態になり、メール確認なしで一連の流れをテストできます。
8. **メール確認を ON のまま使う場合**: Authentication → **URL Configuration** で
   - Site URL: `https://<あなたのVercelドメイン>`
   - Redirect URLs に `https://<あなたのVercelドメイン>/auth/callback` を追加
   （確認メールのリンクがこの `/auth/callback` に戻り、セッションが確立されます）

---

## 2. Stripe（決済）

> 最初は必ず **テストモード**（画面右上のトグル）で進めてください。実際のお金は動きません。

1. https://stripe.com に登録。
2. **Developers → API keys** を開く:
   - `Publishable key`（`pk_test_...`）→ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `Secret key`（`sk_test_...`）→ `STRIPE_SECRET_KEY`（**秘密**）
3. Webhook は Vercel に公開してから設定します（手順4の後）。
4. 本番でお金を扱うには Stripe の **本人確認・事業者審査** が必要です。審査に数日かかることがあるので早めに申請してください。

---

## 3. Vercel に公開する

1. https://vercel.com に GitHub アカウントで登録。
2. 「Add New → Project」→ この GitHub リポジトリ（`summer-goals`）を選択。
3. Framework は自動で **Next.js** が選ばれます。そのまま「Deploy」。
4. 初回は環境変数が無いので一部機能は動きませんが、まずデプロイして URL を確認します。

### Webhook の設定（公開後）

1. Stripe の **Developers → Webhooks → Add endpoint**。
2. URL は `https://あなたのアプリ.vercel.app/api/stripe/webhook`。
3. イベントは最低限 `payment_intent.succeeded` と `payment_intent.payment_failed` を選ぶ。
4. 作成後に表示される `Signing secret`（`whsec_...`）→ `STRIPE_WEBHOOK_SECRET`。

---

## 4. 環境変数を Vercel に貼り付ける

Vercel の **Project → Settings → Environment Variables** に、以下を1つずつ追加します
（名前と値のペア）。値の取得元は上の手順を参照。

| 名前 | どこで取得 | 秘密? |
|---|---|---|
| `DATABASE_URL` | Supabase Connect → Prisma（プール 6543）| ◯ |
| `DIRECT_URL` | Supabase Connect → Prisma（直接 5432）| ◯ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API | ◯ |
| `SUPABASE_STORAGE_BUCKET` | `reports` | |
| `STRIPE_SECRET_KEY` | Stripe API keys | ◯ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys | |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook | ◯ |
| `SYSTEM_FEE_YEN` | `500`（参加費・返金不可）| |
| `DEPOSIT_YEN` | `3000`（デポジット・返金上限）| |
| `DAILY_FORFEIT_YEN` | `100`（サボり1日の失効額）| |
| `CHALLENGE_DURATION_DAYS` | `30` | |
| `CRON_SECRET` | 自分で長いランダム文字列を決める | ◯ |
| `NEXT_PUBLIC_APP_URL` | 公開URL（例 `https://...vercel.app`）| |
| `APP_TIMEZONE` | `Asia/Tokyo` | |

貼り付けたら **再デプロイ**（Deployments → 最新 → Redeploy）。

### データベースの初期化（テーブル作成）

環境変数 `DATABASE_URL` を設定したら、テーブルを作る必要があります。初回マイグレーション
（`prisma/migrations/` に同梱済み）を、開発できる人に1回だけ流してもらってください:

```bash
npx prisma migrate deploy   # 同梱の初回マイグレーションを本番DBに適用
```

> どうしても手早く済ませたい場合は `npx prisma db push`（マイグレーション履歴なしでスキーマを直接反映）も可。
> Supabase の SQL エディタを使う場合は `prisma/migrations/20260801000000_init/migration.sql` の中身を貼り付けて実行しても同じです。

---

## 5. 月末の部分返金バッチについて

- `vercel.json` に設定済みで、**毎日 00:10 JST** に自動実行されます（Vercel Cron）。
- 返金対象は「チャレンジ終了日（`endDate`）を過ぎた参加者」だけなので、実質 **8月末から** 精算が始まります。
- Vercel が `CRON_SECRET` を使って安全に起動します。追加設定は不要です。

### 無料（Hobby）枠での安全設計

Vercel の無料プランは関数の実行が **60秒** までです。返金は1件ずつ Stripe を呼ぶため、参加者が多いと60秒を超えるおそれがあります。そこで本バッチは:

- 1回の実行で **最大 `SETTLEMENT_PAGE_SIZE` 件（既定40）＋約50秒** で打ち切り、
- 残りは翌日の Cron が**続きから自動処理**します（処理済みは対象から外れるので二重返金なし）。

つまり参加者が多くても、**毎日のCronで数日かけて全員に返金が完了**します（返金は急ぎではないので問題ありません）。`SETTLEMENT_PAGE_SIZE` を変えれば1回の件数を調整できます。

### 今すぐ全員分を精算したいとき（手動）

開発できる人に次のいずれかを実行してもらえば、その場で全件処理できます:

```bash
# スクリプト直接実行（時間制限なし。残りが無くなるまで全ページ処理）
STRIPE_SECRET_KEY=sk_test_xxx DATABASE_URL=... npm run settle

# もしくは API 経由（1ページ分。基準日を指定して検証）
curl -H "Authorization: Bearer <CRON_SECRET>" \
  "https://あなたのアプリ.vercel.app/api/cron/settlement?now=2026-08-31"
```

> Pro プランにすると1回で大量処理できます（`SETTLEMENT_PAGE_SIZE` を大きくし、`src/app/api/cron/settlement/route.ts` の `maxDuration` を延ばす）。MVP は無料枠＋上記設計で十分です。

---

## 6. 返金の仕組み（運営向けメモ）

- 8月開始時に **¥3,500 を即時決済**（参加費 ¥500＋デポジット ¥3,000）。オーソリ保留ではなく **必ずキャプチャ** されます（保留は約7日で失効し30日保持できないため）。
- 月末に **¥100 × 報告成功日数**（上限 ¥3,000）を Stripe の Partial Refund で返金します。
- 失効分（サボった日数 × ¥100）＋ 参加費 ¥500 が運営の売上です。
- 同じチャレンジに二重返金は発生しません（`idempotencyKey` で保護）。

---

## 困ったときのチェックリスト

- カード登録が反映されない → Stripe Webhook の URL とイベント、`STRIPE_WEBHOOK_SECRET` を確認。
- ログインできない → Supabase の Email プロバイダが有効か確認。
- 画像が上がらない → Storage バケット `reports` が Public か確認。
- バッチが動かない → `CRON_SECRET` が Vercel に設定され、再デプロイ済みか確認。
