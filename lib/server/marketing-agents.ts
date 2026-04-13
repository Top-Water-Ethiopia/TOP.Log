import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase.types"
import {
  MARKETING_DEPARTMENT_NAME,
  isMarketingDepartmentName,
  isSalesPromoterProfessionKey,
  normalizeSalesPromoterProfessionKey,
  type MarketingAgentSnapshot,
} from "@/lib/marketing-agents"
import { pickJoinedRow } from "@/lib/utils"

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
    .from("user_department_memberships")
    .select(
      `
      department_id,
      role_id,
      department:departments (
        id,
        name
      ),
      role:roles (
        id,
        name,
        display_name
      )
    `
    )
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "profession")
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || !data.role) {
    return null
  }

  const role = pickJoinedRow(data.role)
  const department = pickJoinedRow(data.department)

  const professionKey = role?.name ? normalizeSalesPromoterProfessionKey(role.name) : null
  const departmentName = department?.name ?? null

  if (!data?.department_id || !professionKey || !departmentName) {
    return null
  }

  if (!isMarketingDepartmentName(departmentName) || !isSalesPromoterProfessionKey(professionKey)) {
    return null
  }

  return {
    departmentId: data.department_id,
    departmentName,
    professionId: data.role_id,
    professionKey,
    professionLabel: role?.display_name ?? null,
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
