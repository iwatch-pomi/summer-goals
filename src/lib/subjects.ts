// 科目タグ（GoalGenre）の表示ラベル。フォーム・ランキング等で共有する。

export const SUBJECTS: { value: string; label: string }[] = [
  { value: "ENGLISH", label: "英語" },
  { value: "MATH", label: "数学" },
  { value: "JAPANESE", label: "国語" },
  { value: "SCIENCE", label: "理科" },
  { value: "SOCIAL", label: "社会" },
  { value: "TOEIC", label: "TOEIC" },
  { value: "QUALIFICATION", label: "資格" },
  { value: "MAJOR", label: "専門科目" },
  { value: "OTHER", label: "その他" },
];

export const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.value, s.label])
);

/** 文字列が有効な科目タグか判定して返す（不正なら null）。 */
export function parseSubject(value: string | undefined | null): string | null {
  if (!value) return null;
  return SUBJECT_LABELS[value] ? value : null;
}
