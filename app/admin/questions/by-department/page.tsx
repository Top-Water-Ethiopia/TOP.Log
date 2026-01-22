import { redirect } from "next/navigation"

export default function AdminQuestionsByDepartmentLegacyPage() {
  redirect("/admin/questions?tab=department_lead")
}
