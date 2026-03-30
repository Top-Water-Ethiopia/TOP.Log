import { ReactNode } from "react"
import { createClient } from "@/lib/supabase/server"
import { getLogsHeaderState } from "@/lib/logs-navigation"
import ReportsLayoutShell from "@/components/reports-layout-shell"

interface ReportsLayoutProps {
  children: ReactNode
}

export default async function ReportsLayout({ children }: ReportsLayoutProps) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headerState = await getLogsHeaderState(supabase, session?.user?.id, session?.user?.email)

  return (
    <ReportsLayoutShell
      canAccessAdmin={headerState.canAccessAdmin}
      canCreateNewLog={headerState.canCreateNewLog}
      viewerEmail={headerState.viewerEmail}
      viewerName={headerState.viewerName}
    >
      {children}
    </ReportsLayoutShell>
  )
}
