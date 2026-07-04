import { prisma } from "./prisma";
import { createServiceClient, STORAGE_BUCKET } from "./supabase";

// ===========================================================================
// 退会（ソフトデリート＋7日間の猶予）
// - deactivate: status=PENDING_DELETION、deletionScheduledAt=now+7日 にする
// - reactivate: 猶予中なら取り消して ACTIVE に戻す
// - purgeExpiredAccounts: 予定時刻を過ぎたユーザーを完全削除（日次バッチ）
// ===========================================================================

export const GRACE_DAYS = 7;

/** 退会申請。7日後に削除予定を立てる。 */
export async function deactivateAccount(userId: string) {
  const scheduledAt = new Date();
  scheduledAt.setUTCDate(scheduledAt.getUTCDate() + GRACE_DAYS);
  await prisma.user.update({
    where: { id: userId },
    data: { status: "PENDING_DELETION", deletionScheduledAt: scheduledAt },
  });
  return scheduledAt;
}

/** 退会の取り消し（猶予期間中のみ有効）。 */
export async function reactivateAccount(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", deletionScheduledAt: null },
  });
}

/** 1ユーザーを完全削除（DB・ストレージ写真・Supabase Auth）。 */
export async function purgeUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const service = createServiceClient();

  // 1. ストレージの写真を削除（DBを消す前にパスを集める）。
  const photos = await prisma.report.findMany({
    where: { userId, photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  const paths = photos.map((p) => p.photoUrl).filter((p): p is string => !!p);
  if (paths.length > 0) {
    await service.storage.from(STORAGE_BUCKET).remove(paths).catch(() => {});
  }

  // 2. DB を依存順に削除（Report.userId と Room.createdById は RESTRICT のため先に）。
  //    User 削除で Goal / Challenge / RoomMember は Cascade で消える。
  await prisma.$transaction([
    prisma.report.deleteMany({ where: { userId } }),
    prisma.room.deleteMany({ where: { createdById: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  // 3. Supabase Auth のユーザーを削除（avatarSeed に Auth の user id を保持している）。
  try {
    await service.auth.admin.deleteUser(user.avatarSeed);
  } catch (e) {
    console.error(`[purge] auth delete failed for ${userId}:`, e);
  }
}

export interface PurgeSummary {
  purged: number;
  failed: number;
}

/** 猶予を過ぎた退会ユーザーをまとめて完全削除する（日次バッチ）。 */
export async function purgeExpiredAccounts(now: Date = new Date()): Promise<PurgeSummary> {
  const targets = await prisma.user.findMany({
    where: {
      status: "PENDING_DELETION",
      deletionScheduledAt: { not: null, lte: now },
    },
    select: { id: true },
  });

  const summary: PurgeSummary = { purged: 0, failed: 0 };
  for (const t of targets) {
    try {
      await purgeUser(t.id);
      summary.purged += 1;
    } catch (e) {
      summary.failed += 1;
      console.error(`[purge] failed for ${t.id}:`, e);
    }
  }
  return summary;
}
