import { redirect } from "next/navigation"
import { VALID_QUESTION_TABS, type QuestionTab } from "@/lib/reporting-model"

export default function AdminQuestionsByDepartmentLegacyPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab = searchParams.tab as QuestionTab
  const validatedTab = VALID_QUESTION_TABS.includes(tab) ? tab : "department_reports"

  redirect(`/admin/questions?tab=${validatedTab}`)
}
