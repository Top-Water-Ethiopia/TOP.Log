import useSWR from "swr"

export interface ScopeEntryKind {
  id: string
  department_id: string
  department_profession_id: string | null // TEXT (profession key), not UUID
  profession_role_id?: string | null
  scope_type?: ScopeEntryKindScopeType
  entry_kind: string
  label: string
  description: string | null
  sort_order: number
  is_default: boolean
  is_active: boolean
  is_available: boolean
  allowed_weekdays: number[] | null
  available_start_date: string | null
  available_end_date: string | null
  supports_assigned_agent: boolean
  allow_multiple_per_day: boolean
  color: string | null
  icon: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ScopeEntryKindsResponse {
  data: ScopeEntryKind[]
  scope: "department" | "profession"
  self_healed: boolean
}

async function fetcher(url: string): Promise<ScopeEntryKindsResponse> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to fetch scope entry kinds")
  }
  return res.json()
}

export function useScopeEntryKinds(departmentId: string | null, departmentProfessionId?: string | null) {
  const shouldFetch = departmentId != null
  const url = shouldFetch
    ? `/api/admin/scope-entry-kinds?departmentId=${encodeURIComponent(departmentId!)}${
        departmentProfessionId ? `&departmentProfessionId=${encodeURIComponent(departmentProfessionId)}` : ""
      }`
    : null

  const { data, error, isLoading, mutate } = useSWR<ScopeEntryKindsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  return {
    entryKinds: data?.data || [],
    scope: data?.scope || "department",
    selfHealed: data?.self_healed || false,
    isLoading,
    error,
    mutate,
  }
}

export type ScopeEntryKindScopeType = "dept_wide_personal" | "profession_personal" | "dept_report"

export function useScopeEntryKindsV2(
  departmentId: string | null,
  params: { scopeType: ScopeEntryKindScopeType; professionRoleId?: string | null }
) {
  const shouldFetch =
    departmentId != null && (params.scopeType !== "profession_personal" || !!params.professionRoleId)
  const url = shouldFetch
    ? `/api/admin/scope-entry-kinds?departmentId=${encodeURIComponent(departmentId!)}&scopeType=${encodeURIComponent(
        params.scopeType
      )}${params.professionRoleId ? `&professionRoleId=${encodeURIComponent(params.professionRoleId)}` : ""}`
    : null

  const { data, error, isLoading, mutate } = useSWR<ScopeEntryKindsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  return {
    entryKinds: data?.data || [],
    scope: data?.scope || "department",
    selfHealed: data?.self_healed || false,
    isLoading,
    error,
    mutate,
  }
}
