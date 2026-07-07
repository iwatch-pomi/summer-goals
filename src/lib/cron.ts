import { timingSafeEqual } from "crypto";

// Vercel Cron 用の Bearer 認証。CRON_SECRET と定数時間で比較する
// （長さ差・内容差でタイミングが変わらないようにし、秘密の推測を困難にする）。
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(expected);
  // 長さが違うと timingSafeEqual が例外を投げるため、先に長さで弾く。
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
