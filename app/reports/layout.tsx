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
  const contact = session?.user?.email || (session?.user as any)?.phone || null
  const headerState = await getLogsHeaderState(supabase, session?.user?.id, contact)

  return (
    <ReportsLayoutShell
      isAuthenticated={!!session?.user?.id}
      canAccessAdmin={headerState.canAccessAdmin}
      canAccessLogs={headerState.canAccessLogs}
      canCreateNewLog={headerState.canCreateNewLog}
      logsDisabledReason={headerState.logsDisabledReason}
      createDisabledReason={headerState.createDisabledReason}
      viewerContact={headerState.viewerContact}
      viewerName={headerState.viewerName}
    >
      {children}
    </ReportsLayoutShell>
  )
}
