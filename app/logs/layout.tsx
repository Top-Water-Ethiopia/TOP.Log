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
    data: { session },
  } = await supabase.auth.getSession()
  const headerState = await getLogsHeaderState(supabase, session?.user?.id, session?.user?.email)

  return (
    <LogsLayoutShell
      canAccessAdmin={headerState.canAccessAdmin}
      canCreateNewLog={headerState.canCreateNewLog}
      viewerEmail={headerState.viewerEmail}
      viewerName={headerState.viewerName}
    >
      {children}
    </LogsLayoutShell>
  )
}
