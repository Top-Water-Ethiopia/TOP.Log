import type { SupabaseClient } from "@supabase/supabase-js"

export type UserDepartmentProfessionAssignment = {
  professionId: string | null
  professionKey: string | null
}

export async function getUserDepartmentProfessionAssignment(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<UserDepartmentProfessionAssignment | null> {
  const { data, error } = await supabase
    .from("user_department_professions")
    .select("department_role_id, role")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) return null

  return {
    professionId: typeof data.department_role_id === "string" ? data.department_role_id : null,
    professionKey: typeof data.role === "string" ? data.role : null,
  }
}

export async function userCanAnswerDepartmentQuestions(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<boolean> {
  const { data: assignment, error: assignmentError } = await supabase
    .from("user_department_access_levels")
    .select("access_level_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .maybeSingle()

  if (assignmentError) throw assignmentError

  const accessLevelId = typeof assignment?.access_level_id === "string" ? assignment.access_level_id : null
  if (!accessLevelId) return false

  const { data: permissionDefinition, error: permissionDefinitionError } = await supabase
    .from("permission_definitions")
    .select("id")
    .eq("resource", "department_questions")
    .eq("action", "answer")
    .single()

  if (permissionDefinitionError || !permissionDefinition?.id) {
    return false
  }

  const { data: permissionRow, error: permissionError } = await supabase
    .from("department_access_level_permissions")
    .select("effect")
    .eq("access_level_id", accessLevelId)
    .eq("permission_definition_id", permissionDefinition.id)
    .limit(1)
    .maybeSingle()

  if (permissionError) throw permissionError

  return permissionRow?.effect === "allow"
}
