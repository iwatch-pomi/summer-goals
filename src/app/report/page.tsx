import { redirect } from "next/navigation";
import { GoalStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReportForm from "@/components/ReportForm";

export const dynamic = "force-dynamic";

// 報告ページ。報告の前に「目標」を必須にするゲート。
// 進行中の目標が無ければ、先に目標作成へ誘導する（作成後この画面へ戻る）。
export default async function ReportPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signup?mode=login");
  }

  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: GoalStatus.ACTIVE },
    select: { id: true },
  });
  if (!goal) {
    redirect("/goals/new?next=/report");
  }

  return <ReportForm />;
}
