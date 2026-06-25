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
3. 左メニュー **Project Settings → Database** を開く:
   - 「Connection string」→「URI」をコピー → これが `DATABASE_URL`。
     （`[YOUR-PASSWORD]` の部分を 2 で決めたパスワードに置き換える）
4. 左メニュー **Project Settings → API** を開く:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY`（**秘密。絶対に公開しない**）
5. 左メニュー **Storage** で「New bucket」→ 名前を `reports`・**Public** で作成（進捗写真の保管先）。
   - バケット名を `SUPABASE_STORAGE_BUCKET` に設定（既定は `reports`）。
6. 左メニュー **Authentication → Providers** で「Email」が有効になっていることを確認。

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
3. イベントは最低限 `setup_intent.succeeded` と `payment_intent.payment_failed` を選ぶ。
4. 作成後に表示される `Signing secret`（`whsec_...`）→ `STRIPE_WEBHOOK_SECRET`。

---

## 4. 環境変数を Vercel に貼り付ける

Vercel の **Project → Settings → Environment Variables** に、以下を1つずつ追加します
（名前と値のペア）。値の取得元は上の手順を参照。

| 名前 | どこで取得 | 秘密? |
|---|---|---|
| `DATABASE_URL` | Supabase Database | ◯ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API | ◯ |
| `SUPABASE_STORAGE_BUCKET` | `reports` | |
| `STRIPE_SECRET_KEY` | Stripe API keys | ◯ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys | |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook | ◯ |
| `PENALTY_AMOUNT_JPY` | `500` | |
| `CRON_SECRET` | 自分で長いランダム文字列を決める | ◯ |
| `GIFT_PROVIDER` | `manual`（最初はこれ）| |
| `GIFT_API_KEY` | ギフト契約後に設定（最初は空でOK）| ◯ |
| `NEXT_PUBLIC_APP_URL` | 公開URL（例 `https://...vercel.app`）| |
| `APP_TIMEZONE` | `Asia/Tokyo` | |

貼り付けたら **再デプロイ**（Deployments → 最新 → Redeploy）。

### データベースの初期化（テーブル作成）

環境変数 `DATABASE_URL` を設定したら、テーブルを作る必要があります。これだけは
一度コマンドが必要なので、開発できる人に以下を1回だけ実行してもらってください
（または Supabase の SQL エディタで Prisma が生成する SQL を実行）:

```bash
npx prisma migrate deploy   # 本番DBにテーブルを作成
```

> ローカルで開発する場合は `npx prisma migrate dev --name init` で初回マイグレーションを作成します。

---

## 5. 日次バッチ（サボり判定）について

- `vercel.json` に設定済みで、**毎日 00:10 JST** に自動実行されます（Vercel Cron）。
- Vercel が `CRON_SECRET` を使って安全に起動します。追加設定は不要です。
- 手動で動作確認したいときは、開発者に次を実行してもらってください:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  "https://あなたのアプリ.vercel.app/api/cron/daily-penalty?date=2026-08-10"
```

---

## 6. ギフト発行について

- MVP の既定は `GIFT_PROVIDER=manual`。これは「サボりが発生したら運営が手動で
  相方にギフトを送る」モードです。まずはこれで運用を始められます。
- giftee などの eGift API を契約したら、`GIFT_PROVIDER=giftee` に変更し
  `GIFT_API_KEY` を設定、`src/lib/gift.ts` の `issueViaGiftee` を実装すれば自動化できます。

---

## 困ったときのチェックリスト

- カード登録が反映されない → Stripe Webhook の URL とイベント、`STRIPE_WEBHOOK_SECRET` を確認。
- ログインできない → Supabase の Email プロバイダが有効か確認。
- 画像が上がらない → Storage バケット `reports` が Public か確認。
- バッチが動かない → `CRON_SECRET` が Vercel に設定され、再デプロイ済みか確認。
