export type DepartmentRoleFilterQuestion = {
  department_id?: string | null
  department_profession_id?: string | null
  department_role?: string | null
  department_profession?: {
    id: string
    key: string
    label: string
  } | null
}

export function matchesDepartmentRoleFilter(
  question: DepartmentRoleFilterQuestion,
  departmentId: string,
  departmentRole: string
): boolean {
  if (question.department_id !== departmentId) return false

  const candidates = [
    question.department_profession_id,
    question.department_role,
    question.department_profession?.id,
    question.department_profession?.key,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)

  return candidates.includes(departmentRole)
}
