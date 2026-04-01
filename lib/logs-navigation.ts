import { createClient } from "@/lib/supabase/server"
import { getReportStatus } from "@/lib/completion-status"

interface LogsViewerProfile {
  name: string | null
  department_id: string | null
  role_name: string | null
}

export interface LogsHeaderState {
  canAccessAdmin: boolean
  canCreateNewLog: boolean
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

  const { data: accessAssignments, error: accessError } = await supabase
    .from("user_department_access_levels")
    .select("department_id")
    .eq("user_id", userId)
    .order("department_id", { ascending: true })
    .limit(1)

  if (!accessError && accessAssignments?.length) {
    return accessAssignments[0].department_id || null
  }

  const { data, error } = await supabase
    .from("user_department_professions")
    .select("department_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("department_id", { ascending: true })
    .limit(1)

  if (error || !data?.length) {
    return null
  }

  return data[0].department_id || null
}

export async function getLogsHeaderState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionUserId?: string,
  sessionEmail?: string | null
): Promise<LogsHeaderState> {
  const headerState: LogsHeaderState = {
    canAccessAdmin: false,
    canCreateNewLog: false,
    viewerEmail: sessionEmail || null,
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
    return headerState
  }

  const reportStatus = await getReportStatus(supabase, sessionUserId, primaryDepartmentId)
  headerState.canCreateNewLog = !reportStatus.isFullySubmitted

  return headerState
}
