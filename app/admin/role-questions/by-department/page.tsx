import { redirect } from "next/navigation"

export default function AdminRoleQuestionsLegacyByDepartmentPage() {
  redirect("/admin/questions?tab=department_lead")
}
