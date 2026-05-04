import "dotenv/config"
import { adminSupabase } from "../lib/supabase/admin"

const KEEP_DEPARTMENT_NAMES = new Set(["marketing", "information technology"])

function normalizeName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase()
}

async function selectIds(table: string, column = "id") {
  const { data, error } = await (adminSupabase as any).from(table).select(column)
  if (error) {
    throw new Error(`Failed to load ${table}: ${error.message}`)
  }
  return Array.isArray(data) ? data.map((row: any) => row[column]).filter(Boolean) : []
}

async function deleteByIds(table: string, ids: string[]) {
  if (ids.length === 0) return 0
  const { error } = await (adminSupabase as any).from(table).delete().in("id", ids)
  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`)
  }
  return ids.length
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("This reset script is development-only. Run it with NODE_ENV=development.")
  }

  const { data: departments, error: departmentsError } = await adminSupabase.from("departments").select("id, name")
  if (departmentsError) {
    throw new Error(`Failed to load departments: ${departmentsError.message}`)
  }

  const keepDepartments = (departments || []).filter((department) =>
    KEEP_DEPARTMENT_NAMES.has(normalizeName(department.name))
  )
  const removeDepartments = (departments || []).filter(
    (department) => !KEEP_DEPARTMENT_NAMES.has(normalizeName(department.name))
  )
  const removeDepartmentIds = removeDepartments.map((department) => department.id)

  const customResponseIds = await selectIds("custom_responses")
  const entryIds = await selectIds("captain_log_entries")
  const roleQuestionIds = await selectIds("role_questions")
  const scopeEntryKindIds = await selectIds("scope_entry_kinds")

  const removedCustomResponses = await deleteByIds("custom_responses", customResponseIds)
  const removedEntries = await deleteByIds("captain_log_entries", entryIds)
  const removedRoleQuestions = await deleteByIds("role_questions", roleQuestionIds)
  const removedScopeEntryKinds = await deleteByIds("scope_entry_kinds", scopeEntryKindIds)

  let removedUserDepartmentMemberships = 0
  let removedMarketingAgents = 0
  let removedRolesCount = 0
  let removedDepartmentsCount = 0
  let nulledUserProfiles = 0

  if (removeDepartmentIds.length > 0) {
    const { data: userMemberships, error: membershipError } = await (adminSupabase as any)
      .from("user_department_memberships")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (membershipError) throw new Error(`Failed to load user_department_memberships: ${membershipError.message}`)
    removedUserDepartmentMemberships = await deleteByIds(
      "user_department_memberships",
      (userMemberships || []).map((row) => row.id)
    )

    const { data: marketingAgents, error: marketingAgentsError } = await (adminSupabase as any)
      .from("marketing_agents")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (marketingAgentsError) throw new Error(`Failed to load marketing_agents: ${marketingAgentsError.message}`)
    removedMarketingAgents = await deleteByIds(
      "marketing_agents",
      (marketingAgents || []).map((row) => row.id)
    )

    const { error: userProfilesError } = await (adminSupabase as any)
      .from("user_profiles")
      .update({ department_id: null })
      .in("department_id", removeDepartmentIds)
    if (userProfilesError) throw new Error(`Failed to null user_profiles.department_id: ${userProfilesError.message}`)
    nulledUserProfiles = removeDepartmentIds.length

    const { data: departmentRoles, error: rolesError } = await (adminSupabase as any)
      .from("roles")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (rolesError) throw new Error(`Failed to load roles: ${rolesError.message}`)
    removedRolesCount = await deleteByIds(
      "roles",
      (departmentRoles || []).map((row) => row.id)
    )

    const { error: departmentsDeleteError } = await (adminSupabase as any)
      .from("departments")
      .delete()
      .in("id", removeDepartmentIds)
    if (departmentsDeleteError) throw new Error(`Failed to delete departments: ${departmentsDeleteError.message}`)
    removedDepartmentsCount = removeDepartmentIds.length
  }

  console.log("Development database reset complete:")
  console.log(
    JSON.stringify(
      {
        keptDepartments: keepDepartments.map((department) => ({
          id: department.id,
          name: department.name,
        })),
        removedDepartments: removeDepartments.map((department) => ({
          id: department.id,
          name: department.name,
        })),
        removedCustomResponses,
        removedEntries,
        removedRoleQuestions,
        removedScopeEntryKinds,
        removedUserDepartmentMemberships,
        removedMarketingAgents,
        removedRolesCount,
        removedDepartmentsCount,
        nulledUserProfiles,
      },
      null,
      2
    )
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
