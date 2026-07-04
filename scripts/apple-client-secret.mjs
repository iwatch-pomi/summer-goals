// Sign in with Apple の「クライアントシークレット（JWT）」を生成するスクリプト。
// Supabase の Apple プロバイダ設定の「Secret Key (for OAuth)」に貼る値を作る。
// 依存パッケージ不要（Node 18+ の標準 crypto だけ）。
//
// 使い方（Apple Developer で取得した値を渡す）:
//   APPLE_TEAM_ID=XXXXXXXXXX \
//   APPLE_KEY_ID=YYYYYYYYYY \
//   APPLE_SERVICES_ID=com.example.summergoals.web \
//   APPLE_P8_PATH=./AuthKey_YYYYYYYYYY.p8 \
//   node scripts/apple-client-secret.mjs
//
// 出力された長い文字列（JWT）を Supabase に貼る。
// ※Apple の仕様上このシークレットは最長6ヶ月で失効するので、期限が切れたら再生成する。

import crypto from "node:crypto";
import fs from "node:fs";

const TEAM_ID = process.env.APPLE_TEAM_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const SERVICES_ID = process.env.APPLE_SERVICES_ID;
const P8_PATH = process.env.APPLE_P8_PATH;

if (!TEAM_ID || !KEY_ID || !SERVICES_ID || !P8_PATH) {
  console.error(
    "環境変数が足りません: APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_SERVICES_ID / APPLE_P8_PATH"
  );
  process.exit(1);
}

const privateKey = fs.readFileSync(P8_PATH, "utf8");
const now = Math.floor(Date.now() / 1000);

const header = { alg: "ES256", kid: KEY_ID };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 60 * 60 * 24 * 180, // 約6ヶ月（Appleの上限）
  aud: "https://appleid.apple.com",
  sub: SERVICES_ID,
};

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const signingInput = `${b64(header)}.${b64(payload)}`;

// ES256（ECDSA P-256 / SHA-256）。JOSE は生の r||s 形式が必要なので ieee-p1363 を指定。
const signature = crypto
  .sign("SHA256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  })
  .toString("base64url");

const jwt = `${signingInput}.${signature}`;
console.log("\n=== Supabase の Secret Key (for OAuth) に貼る値 ===\n");
console.log(jwt);
console.log("\n（約6ヶ月で失効。切れたら再実行して更新すること）\n");
