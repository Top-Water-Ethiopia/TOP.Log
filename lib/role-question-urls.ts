export function buildRoleQuestionsApiUrl(options?: {
  departmentId?: string
  departmentOnly?: boolean
  departmentRole?: string
}) {
  const departmentId = options?.departmentId
  const departmentOnly = options?.departmentOnly
  const departmentRole = options?.departmentRole

  if (!departmentId) {
    return "/api/role-questions"
  }

  const params = new URLSearchParams({
    departmentId,
  })

  if (departmentOnly) {
    params.set("scope", "department_only")
  }

  if (departmentRole) {
    params.set("role", departmentRole)
  }

  return `/api/role-questions?${params.toString()}`
}
