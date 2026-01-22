import { redirect } from "next/navigation"

type PageProps = {
  params: {
    roleId: string
  }
}

export default function AdminRoleQuestionsLegacyRolePage({ params }: PageProps) {
  redirect(`/admin/questions/${encodeURIComponent(params.roleId)}`)
}
