// ===========================================================================
// ギフト発行アダプタ
// MVP では実プロバイダ未契約でも動くよう "manual"（手動発行キュー）を既定にする。
// giftee 等の API を契約したら issueViaGiftee を実装し、GIFT_PROVIDER を切り替える。
// ===========================================================================

export type GiftIssueResult =
  | { ok: true; provider: string; code: string }
  | { ok: false; provider: string; error: string };

interface IssueParams {
  toUserId: string;
  toEmail: string;
  amountJpy: number;
}

const PROVIDER = process.env.GIFT_PROVIDER ?? "manual";

/**
 * eGift を発行する。成功すると giftCode（受け取りURL等）を返す。
 * manual の場合は「運営が手動で発行するキューに積んだ」とみなし、
 * 後から運営ダッシュボード等で処理する前提のスタブコードを返す。
 */
export async function issueGift(params: IssueParams): Promise<GiftIssueResult> {
  switch (PROVIDER) {
    case "giftee":
      return issueViaGiftee(params);
    case "manual":
    default:
      return {
        ok: true,
        provider: "manual",
        // 実発行は運営側で行う。識別用のプレースホルダ。
        code: `MANUAL-QUEUE-${params.toUserId}-${Date.now()}`,
      };
  }
}

// 契約後に実装する。giftee API の仕様に合わせて差し替える。
async function issueViaGiftee(_params: IssueParams): Promise<GiftIssueResult> {
  const apiKey = process.env.GIFT_API_KEY;
  if (!apiKey) {
    return { ok: false, provider: "giftee", error: "GIFT_API_KEY 未設定" };
  }
  // TODO: giftee の eGift 発行 API を呼び出し、発行コード/URL を取得する。
  return { ok: false, provider: "giftee", error: "未実装（契約後に実装）" };
}
