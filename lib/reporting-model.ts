import type { QuestionResponse } from "@/lib/rbac/types"
import { normalizeSalesPromoterProfessionKey } from "@/lib/marketing-agents"

export type ReportKind = "personal" | "department" | "mixed"
export const VALID_QUESTION_TABS = ["professions", "department_reports"] as const
export type QuestionTab = (typeof VALID_QUESTION_TABS)[number]

type RoleQuestionScopeLike = {
  department_id?: unknown
  department_profession_id?: unknown
  department_role?: unknown
  question_scope_type?: unknown
}

export type DepartmentProfessionIdentity = {
  professionId?: string | null
  professionKey?: string | null
}

export type RoleQuestionScope =
  | {
      kind: "dept_report" | "dept_wide_personal"
      departmentId: string
    }
  | {
      kind: "profession"
      departmentId: string | null
      departmentProfessionId: string | null
      departmentProfessionKey: string | null
    }

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function resolveRoleQuestionScope(question: RoleQuestionScopeLike): RoleQuestionScope | null {
  const departmentId = getNonEmptyString(question.department_id)
  const departmentProfessionId = getNonEmptyString(question.department_profession_id)
  const departmentProfessionKey = normalizeSalesPromoterProfessionKey(question.department_role)
  const scopeType = getNonEmptyString(question.question_scope_type)

  if (departmentProfessionId || departmentProfessionKey) {
    return {
      kind: "profession",
      departmentId,
      departmentProfessionId,
      departmentProfessionKey,
    }
  }

  if (departmentId) {
    return {
      kind: scopeType === "dept_wide_personal" ? "dept_wide_personal" : "dept_report",
      departmentId,
    }
  }

  return null
}

export function getRoleQuestionScopeCacheKey(scope: RoleQuestionScope): string {
  if (scope.kind === "dept_report") {
    return `dept_report:${scope.departmentId}`
  }

  if (scope.kind === "dept_wide_personal") {
    return `dept_wide_personal:${scope.departmentId}`
  }

  return `profession:${scope.departmentId ?? "unknown"}:${scope.departmentProfessionId ?? "unknown"}:${scope.departmentProfessionKey ?? "unknown"}`
}

export function isDepartmentReportQuestion(question: RoleQuestionScopeLike): boolean {
  return resolveRoleQuestionScope(question)?.kind === "dept_report"
}

export function isDepartmentWidePersonalQuestion(question: RoleQuestionScopeLike): boolean {
  return resolveRoleQuestionScope(question)?.kind === "dept_wide_personal"
}

/**
 * Positive check for profession-scoped questions.
 * Identifies questions owned by a specific profession context.
 */
export function isProfessionQuestion(question: RoleQuestionScopeLike): boolean {
  return resolveRoleQuestionScope(question)?.kind === "profession"
}

export function matchesProfessionQuestion(
  question: RoleQuestionScopeLike,
  departmentId: string,
  identity: DepartmentProfessionIdentity
): boolean {
  const scope = resolveRoleQuestionScope(question)
  if (!scope || scope.kind !== "profession") return false
  if (scope.departmentId && scope.departmentId !== departmentId) return false

  const targetProfessionId = getNonEmptyString(identity.professionId)
  if (targetProfessionId && scope.departmentProfessionId === targetProfessionId) {
    return true
  }

  const targetProfessionKey = normalizeSalesPromoterProfessionKey(identity.professionKey)
  if (targetProfessionKey && scope.departmentProfessionKey === targetProfessionKey) {
    return true
  }

  return false
}

export function getQuestionCategory(question: RoleQuestionScopeLike): string {
  if (isDepartmentReportQuestion(question)) return "department_report"
  if (isDepartmentWidePersonalQuestion(question)) return "dept_wide_personal"
  return "profession_question"
}

export function deriveReportKindFromResponses(
  responses: Array<Pick<QuestionResponse, "questionCategory"> | Record<string, unknown> | null | undefined>
): ReportKind {
  const categories = new Set(
    responses
      .map((response) => {
        if (!response || typeof response !== "object") return null
        const category = "questionCategory" in response ? response.questionCategory : response.questionCategory
        return getNonEmptyString(category)
      })
      .filter((category): category is string => Boolean(category))
  )

  const hasDepartmentResponses = categories.has("department_report")
  const hasProfessionResponses = categories.has("profession_question") || categories.has("custom")

  if (hasDepartmentResponses && hasProfessionResponses) {
    return "mixed"
  }

  if (hasDepartmentResponses) {
    return "department"
  }

  return "personal"
}

export function normalizeReportKind(value: unknown): ReportKind {
  if (value === "department" || value === "mixed") {
    return value
  }

  return "personal"
}
