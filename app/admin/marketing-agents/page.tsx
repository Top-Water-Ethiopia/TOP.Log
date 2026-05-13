import { Suspense } from "react"
import AdminMarketingAgentsClient from "@/app/admin/marketing-agents/client"

export const dynamic = "force-dynamic"

export default function AdminMarketingAgentsPage() {
  return (
    <Suspense fallback={null}>
      <AdminMarketingAgentsClient />
    </Suspense>
  )
}

