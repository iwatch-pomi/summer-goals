import GoalForm from "@/components/GoalForm";

// 目標作成ページ。report ゲートからは ?next=/report で戻り先を指定できる。
export default function NewGoalPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // オープンリダイレクト防止：内部パス（/ 始まり・// 以外）のみ許可。
  const raw = searchParams?.next;
  const next =
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return <GoalForm next={next} />;
}
