import { normalizeSalesPromoterProfessionKey } from "../marketing-agents"

export type ResetScopeEntryKindConfig = {
  entry_kind: string
  label: string
  description?: string | null
  sort_order: number
  is_default: boolean
  is_active: boolean
  supports_assigned_agent: boolean
  color?: string | null
  icon?: string | null
}

type QueryBuilder = {
  select: (...args: any[]) => QueryBuilder
  eq: (...args: any[]) => QueryBuilder
  in: (...args: any[]) => QueryBuilder
  delete: (...args: any[]) => QueryBuilder
  insert: (...args: any[]) => QueryBuilder
  then?: (resolve: any, reject: any) => Promise<any>
}

type AdminClientLike = {
  from: (table: string) => any
}

export type ResetRoleQuestionScopeOptions = {
  departmentId: string
  departmentRoleKey: string
  entryKinds: ResetScopeEntryKindConfig[]
}

export type ResetRoleQuestionScopeResult = {
  deletedQuestionCount: number
  deletedEntryKindCount: number
  reseededEntryKindCount: number
}

export async function resetRoleQuestionScope(
  adminClient: AdminClientLike,
  options: ResetRoleQuestionScopeOptions
): Promise<ResetRoleQuestionScopeResult> {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("resetRoleQuestionScope is development-only")
  }

  const departmentRoleKey = normalizeSalesPromoterProfessionKey(options.departmentRoleKey)
  if (!options.departmentId || !departmentRoleKey) {
    throw new Error("departmentId and departmentRoleKey are required")
  }

  const existingQuestionsResponse = await adminClient
    .from("role_questions")
    .select("id")
    .eq("department_id", options.departmentId)
    .eq("department_role", departmentRoleKey)

  const existingQuestions = Array.isArray((existingQuestionsResponse as any)?.data)
    ? ((existingQuestionsResponse as any).data as Array<{ id: string }>)
    : []

  if (existingQuestions.length > 0) {
    const deleteQuestionsResponse = await adminClient
      .from("role_questions")
      .delete()
      .in(
        "id",
        existingQuestions.map((question) => question.id)
      )

    if ((deleteQuestionsResponse as any)?.error) {
      throw new Error((deleteQuestionsResponse as any).error.message || "Failed to delete role questions")
    }
  }

  const existingEntryKindsResponse = await adminClient
    .from("scope_entry_kinds")
    .select("id")
    .eq("department_id", options.departmentId)
    .eq("department_profession_id", departmentRoleKey)

  const existingEntryKinds = Array.isArray((existingEntryKindsResponse as any)?.data)
    ? ((existingEntryKindsResponse as any).data as Array<{ id: string }>)
    : []

  if (existingEntryKinds.length > 0) {
    const deleteEntryKindsResponse = await adminClient
      .from("scope_entry_kinds")
      .delete()
      .in(
        "id",
        existingEntryKinds.map((entryKind) => entryKind.id)
      )

    if ((deleteEntryKindsResponse as any)?.error) {
      throw new Error((deleteEntryKindsResponse as any).error.message || "Failed to delete scope entry kinds")
    }
  }

  const insertResponse = await adminClient.from("scope_entry_kinds").insert(
    options.entryKinds.map((entryKind) => ({
      department_id: options.departmentId,
      department_profession_id: departmentRoleKey,
      entry_kind: entryKind.entry_kind,
      label: entryKind.label,
      description: entryKind.description || null,
      sort_order: entryKind.sort_order,
      is_default: entryKind.is_default,
      is_active: entryKind.is_active,
      supports_assigned_agent: entryKind.supports_assigned_agent,
      color: entryKind.color || null,
      icon: entryKind.icon || null,
      created_by: null,
      updated_by: null,
    }))
  )

  if ((insertResponse as any)?.error) {
    throw new Error((insertResponse as any).error.message || "Failed to reseed scope entry kinds")
  }

  return {
    deletedQuestionCount: existingQuestions.length,
    deletedEntryKindCount: existingEntryKinds.length,
    reseededEntryKindCount: options.entryKinds.length,
  }
}
