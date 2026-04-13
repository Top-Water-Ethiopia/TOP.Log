import { createClient } from "@/lib/supabase/server"
import { getReportStatus } from "@/lib/completion-status"

interface LogsViewerProfile {
  name: string | null
  department_id: string | null
  role_name: string | null
}

export interface LogsHeaderState {
  canAccessAdmin: boolean
  canAccessLogs: boolean
  canCreateNewLog: boolean
  logsDisabledReason: string | null
  createDisabledReason: string | null
  viewerContact: string | null
  viewerEmail: string | null
  viewerName: string | null
}

async function fetchViewerProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LogsViewerProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      `
      name,
      department_id,
      roles:role_id (
        name
      )
    `
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    name: typeof data.name === "string" ? data.name : null,
    department_id: data.department_id,
    role_name: (data.roles as { name?: string } | null)?.name || null,
  }
}

async function fetchPrimaryDepartmentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  forcedDepartmentId?: string | null
): Promise<string | null> {
  if (forcedDepartmentId) {
    return forcedDepartmentId
  }

  const { data: memberships, error } = await supabase
    .from("user_department_memberships")
    .select("department_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("department_id", { ascending: true })
    .limit(1)

  if (error || !memberships?.length) {
    return null
  }

  return memberships[0].department_id
}

export async function getLogsHeaderState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionUserId?: string,
  sessionContact?: string | null
): Promise<LogsHeaderState> {
  const headerState: LogsHeaderState = {
    canAccessAdmin: false,
    canAccessLogs: false,
    canCreateNewLog: false,
    logsDisabledReason: null,
    createDisabledReason: null,
    viewerContact: sessionContact || null,
    viewerEmail: null,
    viewerName: null,
  }

  if (!sessionUserId) {
    return headerState
  }

  const viewerProfile = await fetchViewerProfile(supabase, sessionUserId)
  headerState.viewerName = viewerProfile?.name || null
  headerState.canAccessAdmin = ["admin", "system-admin", "super-admin"].includes(viewerProfile?.role_name || "")

  const forcedDepartmentId = viewerProfile?.role_name === "user" ? viewerProfile.department_id : null
  const primaryDepartmentId = await fetchPrimaryDepartmentId(supabase, sessionUserId, forcedDepartmentId)

  if (!primaryDepartmentId) {
    headerState.canAccessLogs = false
    headerState.logsDisabledReason = "No department access assigned"
    headerState.createDisabledReason = "No department access assigned"
    return headerState
  }

  const reportStatus = await getReportStatus(supabase, sessionUserId, primaryDepartmentId)
  headerState.canAccessLogs = true
  headerState.canCreateNewLog = !reportStatus.isFullySubmitted
  if (!headerState.canCreateNewLog) {
    headerState.createDisabledReason = "All allowed dates are already submitted"
  }

  return headerState
}
