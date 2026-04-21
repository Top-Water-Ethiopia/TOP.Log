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

export interface ResolutionMetadata {
  source: EntryKindsUsed
  priority: number
  matched_profession_id?: string | null
  is_computed_default: boolean
  entry_kind_version_id?: string | null
  question_set_version_id?: string | null
}

export interface ResolveEntryKindsResult {
  data: any[]
  primary: any | null
  meta: {
    used: EntryKindsUsed
    state: EntryKindsState
    resolution?: Record<string, ResolutionMetadata>
  }
}

async function getPrimaryProfessionRoleId(userId: string, departmentId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_department_memberships")
    .select("role_id, is_primary, last_used_at, created_at")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "profession")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Fallback to dept-wide if membership lookup fails
    return null
  }

  return data?.role_id ? String(data.role_id) : null
}

const SCOPE_PRIORITY: Record<EntryKindsUsed, number> = {
  profession_personal: 3.0,
  dept_wide_personal: 2.5,
  dept_report: 2.0,
}

export async function resolveEntryKinds(input: ResolveEntryKindsInput): Promise<ResolveEntryKindsResult> {
  const { system, departmentId, userId } = input
  const supabase = await createClient()

  const professionRoleId = input.professionRoleId ?? (await getPrimaryProfessionRoleId(userId, departmentId))

  // 1. Fetch all candidates from relevant scopes
  const scopesToFetch: EntryKindsUsed[] = system === "dept_report" 
    ? ["dept_report"] 
    : ["profession_personal", "dept_wide_personal"]

  const candidates: any[] = []

  for (const scope of scopesToFetch) {
    let query = (supabase as any)
      .from("scope_entry_kinds")
      .select(`
        *,
        versions:entry_kind_versions (
          id,
          version,
          question_sets:question_set_versions (
            id,
            is_active
          )
        )
      `)
      .eq("department_id", departmentId)
      .eq("is_active", true)

    if (scope === "profession_personal") {
      if (!professionRoleId) continue
      
      const { data: roleData } = await (supabase as any)
        .from("roles")
        .select("name")
        .eq("id", professionRoleId)
        .maybeSingle()

      const roleName = roleData?.name
      query = query.or(`profession_role_id.eq.${professionRoleId}${roleName ? `,department_profession_id.eq.${roleName}` : ""}`)
    } else {
      // For personal/dept_report, we look for department-wide settings
      query = query.is("department_profession_id", null).is("profession_role_id", null)
      if (scope === "dept_wide_personal") {
        query = query.eq("has_department_sections", true)
      } else {
        query = query.eq("has_department_sections", false)
      }
    }

    const { data: rows, error } = await query
    if (!error && Array.isArray(rows)) {
      candidates.push(...rows.map(r => {
        // Find latest version
        const versions = (r.versions || []) as any[]
        versions.sort((a, b) => b.version - a.version)
        const latestVersion = versions[0]
        const latestQuestionSet = latestVersion?.question_sets?.[0]

        return {
          ...r,
          _resolution: {
            source: scope,
            priority: SCOPE_PRIORITY[scope] || 1.0,
            matched_profession_id: scope === "profession_personal" ? professionRoleId : null,
            is_computed_default: false,
            entry_kind_version_id: latestVersion?.id || null,
            question_set_version_id: latestQuestionSet?.id || null
          }
        }
      }))
    }
  }

  if (candidates.length === 0) {
    return { data: [], primary: null, meta: { used: scopesToFetch[0], state: "CONFIG_NOT_FOUND" } }
  }

  // 2. Deterministic Deduplication & Scoring
  const dedupedMap = new Map<string, any>()
  candidates.sort((a, b) => b._resolution.priority - a._resolution.priority)

  for (const cand of candidates) {
    if (!dedupedMap.has(cand.entry_kind)) {
      dedupedMap.set(cand.entry_kind, cand)
    }
  }

  const finalResults = Array.from(dedupedMap.values())

  // 3. Strict Ordering Formula
  finalResults.sort((a, b) => {
    if (b._resolution.priority !== a._resolution.priority) return b._resolution.priority - a._resolution.priority
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // 4. Primary Selection
  const primary = finalResults[0] || null
  if (primary) primary._resolution.is_computed_default = true

  // 5. Metadata mapping
  const resolutionMetadata: Record<string, ResolutionMetadata> = {}
  const data = finalResults.map(r => {
    const { _resolution, versions, ...clean } = r
    resolutionMetadata[r.entry_kind] = _resolution
    return clean
  })

  return {
    data,
    primary,
    meta: {
      used: primary?._resolution.source || scopesToFetch[0],
      state: "OK",
      resolution: resolutionMetadata
    }
  }
}
