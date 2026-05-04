import { ReactNode } from "react"
import { createClient } from "@/lib/supabase/server"
import { getLogsHeaderState } from "@/lib/logs-navigation"
import LogsLayoutShell from "@/components/logs-layout-shell"

interface LogsLayoutProps {
  children: ReactNode
}

export default async function LogsLayout({ children }: LogsLayoutProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const contact = user?.email || (user as any)?.phone || null
  const headerState = await getLogsHeaderState(supabase, user?.id, contact)

  return (
    <LogsLayoutShell
      isAuthenticated={!!user?.id}
      canAccessAdmin={headerState.canAccessAdmin}
      canAccessLogs={headerState.canAccessLogs}
      canCreateNewLog={headerState.canCreateNewLog}
      logsDisabledReason={headerState.logsDisabledReason}
      createDisabledReason={headerState.createDisabledReason}
      viewerContact={headerState.viewerContact}
      viewerName={headerState.viewerName}
    >
      {children}
    </LogsLayoutShell>
  )
}
