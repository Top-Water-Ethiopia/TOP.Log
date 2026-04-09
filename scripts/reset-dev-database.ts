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

  let removedUserDepartmentProfessions = 0
  let removedUserDepartmentAccessLevels = 0
  let removedMarketingAgents = 0
  let removedDepartmentProfessions = 0
  let removedDepartmentsCount = 0
  let nulledUserProfiles = 0
  let nulledRoles = 0

  if (removeDepartmentIds.length > 0) {
    const { data: userDepartmentProfessions, error: udpError } = await (adminSupabase as any)
      .from("user_department_professions")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (udpError) throw new Error(`Failed to load user_department_professions: ${udpError.message}`)
    removedUserDepartmentProfessions = await deleteByIds(
      "user_department_professions",
      (userDepartmentProfessions || []).map((row) => row.id)
    )

    const { data: userDepartmentAccessLevels, error: udalError } = await (adminSupabase as any)
      .from("user_department_access_levels")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (udalError) throw new Error(`Failed to load user_department_access_levels: ${udalError.message}`)
    removedUserDepartmentAccessLevels = await deleteByIds(
      "user_department_access_levels",
      (userDepartmentAccessLevels || []).map((row) => row.id)
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

    const { error: rolesError } = await (adminSupabase as any)
      .from("roles")
      .update({ department_id: null })
      .in("department_id", removeDepartmentIds)
    if (rolesError) throw new Error(`Failed to null roles.department_id: ${rolesError.message}`)
    nulledRoles = removeDepartmentIds.length

    const { data: departmentProfessions, error: departmentProfessionsError } = await (adminSupabase as any)
      .from("department_professions")
      .select("id")
      .in("department_id", removeDepartmentIds)
    if (departmentProfessionsError) {
      throw new Error(`Failed to load department_professions: ${departmentProfessionsError.message}`)
    }
    removedDepartmentProfessions = await deleteByIds(
      "department_professions",
      (departmentProfessions || []).map((row) => row.id)
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
        removedUserDepartmentProfessions,
        removedUserDepartmentAccessLevels,
        removedMarketingAgents,
        removedDepartmentProfessions,
        removedDepartmentsCount,
        nulledUserProfiles,
        nulledRoles,
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
