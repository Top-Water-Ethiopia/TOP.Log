import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  MARKETING_DEPARTMENT_NAME,
  isMarketingDepartmentName,
  isSalesPromoterProfessionKey,
  normalizeSalesPromoterProfessionKey,
  type MarketingAgentSnapshot,
} from "@/lib/marketing-agents"

type SupabaseLike = Pick<SupabaseClient<Database>, "from">

export type SalesPromoterAssignment = {
  departmentId: string
  departmentName: string
  professionId: string | null
  professionKey: string
  professionLabel: string | null
}

export async function getMarketingDepartmentById(
  supabase: SupabaseLike,
  departmentId: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from("departments").select("id, name").eq("id", departmentId).maybeSingle()

  if (error) {
    throw error
  }

  if (!data || !isMarketingDepartmentName(data.name)) {
    return null
  }

  return {
    id: data.id,
    name: data.name,
  }
}

export async function getMarketingDepartment(
  supabase: SupabaseLike
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from("departments").select("id, name").ilike("name", MARKETING_DEPARTMENT_NAME)

  if (error) {
    throw error
  }

  const department = (data || []).find((row: { name?: unknown }) => isMarketingDepartmentName(row.name))
  if (!department) {
    return null
  }

  return {
    id: department.id,
    name: department.name,
  }
}

export async function getSalesPromoterAssignment(
  supabase: SupabaseLike,
  userId: string,
  departmentId: string
): Promise<SalesPromoterAssignment | null> {
  const { data, error } = await supabase
    .from("user_department_professions")
    .select(
      `
      department_id,
      role,
      department_role_id,
      department:departments (
        id,
        name
      ),
      department_profession:department_professions!fk_user_department_professions_department_profession (
        id,
        key,
        label
      )
    `
    )
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  const professionKey =
    typeof data?.department_profession?.key === "string"
      ? normalizeSalesPromoterProfessionKey(data.department_profession.key)
      : typeof data?.role === "string"
        ? normalizeSalesPromoterProfessionKey(data.role)
        : null

  const departmentName = typeof data?.department?.name === "string" ? data.department.name : null

  if (!data?.department_id || !professionKey || !departmentName) {
    return null
  }

  if (!isMarketingDepartmentName(departmentName) || !isSalesPromoterProfessionKey(professionKey)) {
    return null
  }

  return {
    departmentId: data.department_id,
    departmentName,
    professionId: typeof data?.department_profession?.id === "string" ? data.department_profession.id : null,
    professionKey,
    professionLabel: typeof data?.department_profession?.label === "string" ? data.department_profession.label : null,
  }
}

export function buildMarketingAgentSnapshot(agent: {
  name: string
  location?: string | null
  phone_e164?: string | null
  phone_raw?: string | null
}): MarketingAgentSnapshot {
  return {
    name: agent.name,
    location: agent.location ?? null,
    phone: agent.phone_e164 ?? agent.phone_raw ?? null,
  }
}
