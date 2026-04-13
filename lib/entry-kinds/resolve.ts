import { createClient } from "@/lib/supabase/server"

export type EntryKindsSystem = "personal" | "dept_report"

export type EntryKindsState = "OK" | "CONFIG_NOT_FOUND" | "EMPTY_CONFIGURATION"

export type EntryKindsUsed = "dept_wide_personal" | "profession_personal" | "dept_report"

export type EntryKindsErrorCode =
  | "DEPT_REPORT_NOT_CONFIGURED"
  | "DEPT_REPORT_EMPTY_CONFIGURATION"
  | "PERSONAL_DEPT_WIDE_NOT_CONFIGURED"
  | "PERSONAL_DEPT_WIDE_EMPTY_CONFIGURATION"

export class EntryKindsError extends Error {
  code: EntryKindsErrorCode
  status: number

  constructor(code: EntryKindsErrorCode, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface ResolveEntryKindsInput {
  system: EntryKindsSystem
  departmentId: string
  userId: string
  professionRoleId?: string | null // preview override; otherwise primary profession in this department
}

export interface ResolveEntryKindsResult {
  data: any[]
  meta: {
    used: EntryKindsUsed
    state: EntryKindsState
  }
}

async function getPrimaryProfessionRoleId(userId: string, departmentId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_department_memberships")
    .select("role_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "profession")
    .eq("is_active", true)
    .eq("is_primary", true)
    .maybeSingle()

  if (error) {
    // Fallback to dept-wide if membership lookup fails
    return null
  }

  return data?.role_id ? String(data.role_id) : null
}

async function loadTargetConfigs(params: {
  departmentId: string
  scopeType: EntryKindsUsed
  professionRoleId?: string | null
}) {
  const supabase = await createClient()
  const { departmentId, scopeType, professionRoleId } = params

  let query = (supabase as any)
    .from("scope_entry_kinds")
    .select("*")
    .eq("department_id", departmentId)
    .eq("scope_type", scopeType)

  if (scopeType === "profession_personal") {
    if (professionRoleId) {
      query = query.eq("profession_role_id", professionRoleId)
    } else {
      // No profession context → treat as not configured
      return { rows: [] as any[], state: "CONFIG_NOT_FOUND" as const }
    }
  } else {
    // For department targets, constrain legacy field to null to avoid mixing with old profession rows
    query = query.is("department_profession_id", null)
  }

  let { data, error } = (await query) as any
  if (error) {
    return { rows: [] as any[], state: "CONFIG_NOT_FOUND" as const }
  }

  let rows = Array.isArray(data) ? data : []

  // Dual-read fallback for profession_personal during migration:
  // if no rows exist with profession_role_id, try legacy department_profession_id == professionRoleId (UUID-as-text).
  if (scopeType === "profession_personal" && rows.length === 0 && professionRoleId) {
    const legacyQuery = (supabase as any)
      .from("scope_entry_kinds")
      .select("*")
      .eq("department_id", departmentId)
      .eq("scope_type", scopeType)
      .eq("department_profession_id", professionRoleId)

    const legacyRes = (await legacyQuery) as any
    if (!legacyRes?.error && Array.isArray(legacyRes?.data)) {
      rows = legacyRes.data
    }
  }

  if (rows.length === 0) return { rows, state: "CONFIG_NOT_FOUND" as const }

  const active = rows.filter((r) => r?.is_active)
  if (active.length === 0) return { rows, state: "EMPTY_CONFIGURATION" as const }

  // Return active only, ordered
  active.sort((a: any, b: any) => {
    if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    return String(a.label ?? "").localeCompare(String(b.label ?? ""))
  })

  return { rows: active, state: "OK" as const }
}

export async function resolveEntryKinds(input: ResolveEntryKindsInput): Promise<ResolveEntryKindsResult> {
  const { system, departmentId, userId } = input

  if (system === "dept_report") {
    const { rows, state } = await loadTargetConfigs({ departmentId, scopeType: "dept_report" })
    if (state === "CONFIG_NOT_FOUND") {
      throw new EntryKindsError(
        "DEPT_REPORT_NOT_CONFIGURED",
        "Department reports require explicit entry kind configuration for this department.",
        400
      )
    }
    if (state === "EMPTY_CONFIGURATION") {
      throw new EntryKindsError(
        "DEPT_REPORT_EMPTY_CONFIGURATION",
        "Department report entry kinds are configured but none are active.",
        400
      )
    }
    return { data: rows, meta: { used: "dept_report", state } }
  }

  const overrideProfessionRoleId = input.professionRoleId ?? null
  const professionRoleId = overrideProfessionRoleId ?? (await getPrimaryProfessionRoleId(userId, departmentId))

  // 1) Try profession_personal; if missing/empty, fallback to dept-wide personal
  if (professionRoleId) {
    const profession = await loadTargetConfigs({
      departmentId,
      scopeType: "profession_personal",
      professionRoleId,
    })
    if (profession.state === "OK") {
      return { data: profession.rows, meta: { used: "profession_personal", state: "OK" } }
    }
  }

  const deptWide = await loadTargetConfigs({ departmentId, scopeType: "dept_wide_personal" })
  if (deptWide.state === "CONFIG_NOT_FOUND") {
    return { data: [], meta: { used: "dept_wide_personal", state: "CONFIG_NOT_FOUND" } }
  }
  if (deptWide.state === "EMPTY_CONFIGURATION") {
    return { data: [], meta: { used: "dept_wide_personal", state: "EMPTY_CONFIGURATION" } }
  }

  return { data: deptWide.rows, meta: { used: "dept_wide_personal", state: "OK" } }
}
