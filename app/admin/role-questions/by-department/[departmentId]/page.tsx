import { redirect } from "next/navigation"

type PageProps = {
  params: {
    departmentId: string
  }
}

export default function AdminRoleQuestionsLegacyByDepartmentDetailPage({ params }: PageProps) {
  redirect(`/admin/questions/by-department/${encodeURIComponent(params.departmentId)}`)
}
