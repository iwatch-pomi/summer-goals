# セットアップ手順（プログラミング不要）

このアプリを動かすには、2つの外部サービス（**Supabase / Vercel**）に無料登録し、
鍵（キー）をコピーして貼り付けるだけです。順番にやれば1時間程度で本番公開まで届きます。

> 用語: 「環境変数」= サービスのパスワードや鍵をアプリに教えるための設定値。
> Vercel の管理画面に貼り付けるだけで、ファイルを編集する必要はありません。

---

## 全体の流れ

1. Supabase でデータベース・ログイン・画像保管を用意する
2. GitHub のこのリポジトリを Vercel に接続して公開する
3. 環境変数（鍵）を Vercel に貼り付ける
4. データベースにテーブルを作成する
5. 動作確認

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

### ソーシャルログイン（Google / Apple）

アプリ側は実装済み。Supabase で各プロバイダを有効化すれば動く。共通の戻り先は
Supabase の `https://<プロジェクト>.supabase.co/auth/v1/callback`（Supabase が案内）。

**Google**（無料・簡単）
1. Google Cloud Console → 「OAuth 2.0 クライアント ID」を作成（種類: ウェブ）。
2. 承認済みリダイレクト URI に上記 Supabase コールバックを追加。
3. Supabase → Authentication → Providers → **Google** を ON。クライアント ID/シークレットを登録。

**Apple**（Apple Developer 有料登録が必要）
1. Apple Developer → **Identifiers → Services ID** を作成（例 `com.example.sansho.web`）。
   これが Supabase の「Client IDs（Services ID）」になる。
2. その Services ID の「Sign in with Apple」を Configure:
   - Primary App ID: 対象の App ID（Sign in with Apple 有効）。
   - **Domains**: `<プロジェクト>.supabase.co`（ドメイン検証は Supabase が処理するので自前ドメイン不要）
   - **Return URLs**: `https://<プロジェクト>.supabase.co/auth/v1/callback`
3. **Keys → +** で「Sign in with Apple」用の Key を作成し `.p8` をダウンロード（1回のみ）。
   **Key ID** と（アカウントの）**Team ID** を控える。
4. Supabase → Authentication → Providers → **Apple** を ON。
   - Client IDs: 手順1の Services ID
   - Secret Key: Team ID / Key ID / Services ID / `.p8` から JWT を生成して貼る。
     生成は同梱スクリプトが簡単:
     ```bash
     APPLE_TEAM_ID=XXXX APPLE_KEY_ID=YYYY \
     APPLE_SERVICES_ID=com.example.sansho.web \
     APPLE_P8_PATH=./AuthKey_YYYY.p8 \
     node scripts/apple-client-secret.mjs
     ```
     出力された JWT を貼る。**約6ヶ月で失効する**ので、切れたら再生成して更新する。
5. Site URL / Redirect URLs（上の 8）に本番ドメインが入っていることを確認。

> 補足: 名前（ユーザーネーム）は Google/Apple では初回ログイン後の `/onboarding` で入力する
> （匿名で使える）。プロバイダ未設定のうちは、そのボタンだけエラーになる。

---

## 2. Vercel に公開する

1. https://vercel.com に GitHub アカウントで登録。
2. 「Add New → Project」→ この GitHub リポジトリを選択。
3. Framework は自動で **Next.js** が選ばれます。そのまま「Deploy」。
4. 初回は環境変数が無いので一部機能は動きませんが、まずデプロイして URL を確認します。

---

## 3. 環境変数を Vercel に貼り付ける

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
| `CRON_SECRET` | 自分で長いランダム文字列を決める | ◯ |
| `NEXT_PUBLIC_APP_URL` | 公開URL（例 `https://...vercel.app`）| |
| `APP_TIMEZONE` | `Asia/Tokyo` | |

貼り付けたら **再デプロイ**（Deployments → 最新 → Redeploy）。

### データベースの初期化（テーブル作成）

環境変数 `DATABASE_URL` / `DIRECT_URL` を設定したら、テーブルを作る必要があります。
開発できる人に、同梱済みのマイグレーション（`prisma/migrations/`）を1回だけ流してもらってください:

```bash
DATABASE_URL="<Supabaseのプール接続>" DIRECT_URL="<Supabaseの直接接続>" npx prisma migrate deploy
```

> どうしても手早く済ませたい場合は `npx prisma db push`（マイグレーション履歴なしでスキーマを直接反映）も可。

---

## 4. アカウント退会バッチについて

- `vercel.json` に設定済みで、**毎日決まった時刻（JST）** に `/api/cron/purge-accounts` が自動実行されます（Vercel Cron）。
- 退会申請から一定の猶予期間（`src/lib/account.ts` の `GRACE_DAYS`）が過ぎたアカウントを完全削除します。
- Vercel が `CRON_SECRET` を使って安全に起動します。追加設定は不要です。

---

## 困ったときのチェックリスト

- ログインできない → Supabase の Email プロバイダが有効か確認。
- 画像が上がらない → Storage バケット `reports` が存在し、`SUPABASE_STORAGE_BUCKET` と名前が一致しているか確認。
- 退会バッチが動かない → `CRON_SECRET` が Vercel に設定され、再デプロイ済みか確認。
- ランキング/進捗が表示されない → `DATABASE_URL` / `DIRECT_URL` が正しいか、`prisma migrate deploy` を実行済みか確認。
