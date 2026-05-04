import { Suspense } from "react"

import AdminRoleQuestionsPage from "./page.client"

export default function AdminQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <AdminRoleQuestionsPage />
    </Suspense>
  )
}
