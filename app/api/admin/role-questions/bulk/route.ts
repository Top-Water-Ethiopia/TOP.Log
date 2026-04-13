import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import {
  findDuplicateValues,
  getLegacyQuestionKeyFromMetadata,
  normalizeQuestionKey,
} from "@/lib/role-question-identity"
import { getRoleQuestionScopeCacheKey, resolveRoleQuestionScope } from "@/lib/reporting-model"
import {
  ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
  getAssignedAgentsDailyLimit,
  getQuestionOptionSource,
  isMarketingDepartmentName,
  isSalesPromoterProfessionKey,
  normalizeSalesPromoterProfessionKey,
} from "@/lib/marketing-agents"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

// Normalize entry kind to lowercase
function normalizeEntryKind(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "standard"
  return value.trim().toLowerCase()
}

// Load valid entry kinds for a scope from database
async function loadScopeEntryKinds(
  departmentId: string,
  params: { scopeType: "dept_wide_personal" | "profession_personal" | "dept_report"; professionRoleId?: string | null }
): Promise<Array<{ entry_kind: string; is_active: boolean }>> {
  try {
    const scopeType = params.scopeType
    const professionRoleId = params.professionRoleId ?? null

    const query = (adminSupabase as any)
      .from("scope_entry_kinds")
      .select("entry_kind, is_active")
      .eq("department_id", departmentId)
      .eq("scope_type", scopeType)

    if (scopeType === "profession_personal") {
      query.eq("profession_role_id", professionRoleId)
    } else {
      query.is("department_profession_id", null)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error loading scope entry kinds:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Unexpected error loading scope entry kinds:", error)
    return []
  }
}

// Collect entry kind validation errors with scope-aware lookup
async function collectEntryKindErrors(questions: any[]): Promise<{ errors: string[]; normalizedQuestions: any[] }> {
  const errors: string[] = []
  const scopeKeys = new Set<string>()

  // First pass: collect all unique scopes
  questions.forEach((question) => {
    const scope = getQuestionScope(question)
    if (!scope) return

    const deptId = scope.kind === "profession" ? scope.departmentId : scope.id
    const scopeType =
      scope.kind === "profession"
        ? "profession_personal"
        : scope.kind === "dept_wide_personal"
          ? "dept_wide_personal"
          : "dept_report"
    const professionRoleId = scope.kind === "profession" ? scope.departmentProfessionId : null
    const scopeKey = `${deptId}:${scopeType}:${professionRoleId || "null"}`
    scopeKeys.add(scopeKey)
  })

  // Load valid entry kinds for each scope
  const scopeValidKinds = new Map<string, Set<string>>()

  await Promise.all(
    Array.from(scopeKeys).map(async (scopeKey) => {
      const [deptId, scopeType, professionRoleId] = scopeKey.split(":")
      const kinds = await loadScopeEntryKinds(deptId, {
        scopeType: (scopeType as any) || "dept_wide_personal",
        professionRoleId: professionRoleId === "null" ? null : professionRoleId,
      })
      // Accept both active and inactive entry kinds (legacy support)
      scopeValidKinds.set(scopeKey, new Set(kinds.map((k) => k.entry_kind.toLowerCase())))
    })
  )

  // Validate each question and normalize entry_kind
  const normalizedQuestions = questions.map((question, index) => {
    const scope = getQuestionScope(question)
    if (!scope) return question

    const deptId = scope.kind === "profession" ? scope.departmentId : scope.id
    const scopeType =
      scope.kind === "profession"
        ? "profession_personal"
        : scope.kind === "dept_wide_personal"
          ? "dept_wide_personal"
          : "dept_report"
    const professionRoleId = scope.kind === "profession" ? scope.departmentProfessionId : null
    const scopeKey = `${deptId}:${scopeType}:${professionRoleId || "null"}`

    const validKinds = scopeValidKinds.get(scopeKey)
    const rawEntryKind = question.entry_kind || "standard"
    const normalizedEntryKind = normalizeEntryKind(rawEntryKind)

    // If scope has no configured entry kinds, allow any (graceful degradation)
    if (validKinds && validKinds.size > 0 && !validKinds.has(normalizedEntryKind)) {
      errors.push(
        `Question ${index + 1}: Entry kind "${rawEntryKind}" is not configured for this scope. ` +
          `Allowed kinds: ${Array.from(validKinds).join(", ")}`
      )
    }

    // Return question with normalized entry_kind
    return {
      ...question,
      entry_kind: normalizedEntryKind,
    }
  })

  return { errors, normalizedQuestions }
}

export const dynamic = "force-dynamic"

function getLegacyQuestionKey(question: any): string | null {
  if (typeof question?.question_key === "string") {
    const trimmed = question.question_key.trim()
    return trimmed ? trimmed : null
  }

  return getLegacyQuestionKeyFromMetadata(question?.metadata)
}

function mergeMetadata(existingMeta: unknown, incomingMeta: unknown, legacyQuestionKey: string | null) {
  const base = typeof existingMeta === "object" && existingMeta !== null ? existingMeta : {}
  const incoming = typeof incomingMeta === "object" && incomingMeta !== null ? incomingMeta : {}
  return {
    ...base,
    ...incoming,
    ...(legacyQuestionKey ? { legacy_question_key: legacyQuestionKey } : {}),
  }
}

function getQuestionScope(question: any):
  | {
      kind: "profession"
      departmentId: string
      departmentProfessionId: string | null
      departmentProfessionKey: string | null
    }
  | { kind: "dept_report" | "dept_wide_personal"; id: string }
  | null {
  const scope = resolveRoleQuestionScope(question)
  if (!scope) return null

  if (scope.kind === "dept_report" || scope.kind === "dept_wide_personal") {
    return { kind: scope.kind, id: scope.departmentId }
  }

  if (!scope.departmentId) {
    return null
  }

  return {
    kind: "profession",
    departmentId: scope.departmentId,
    departmentProfessionId: scope.departmentProfessionId,
    departmentProfessionKey: scope.departmentProfessionKey,
  }
}

function getScopeCacheKey(scope: NonNullable<ReturnType<typeof getQuestionScope>>): string {
  if (scope.kind !== "profession") {
    return getRoleQuestionScopeCacheKey({
      kind: scope.kind,
      departmentId: scope.id,
    })
  }

  return getRoleQuestionScopeCacheKey({
    kind: "profession",
    departmentId: scope.departmentId,
    departmentProfessionId: scope.departmentProfessionId,
    departmentProfessionKey: scope.departmentProfessionKey,
  })
}

function resolveIncomingQuestionKey(question: any, index: number): string {
  const directKey = getLegacyQuestionKey(question)
  if (directKey) return directKey

  const normalizedLabel = normalizeQuestionKey(String(question?.question_label ?? ""))
  if (normalizedLabel) return normalizedLabel

  return `question_${index + 1}`
}

function getDuplicateKeyScopeKey(question: any): string | null {
  const scope = getQuestionScope(question)
  if (!scope) return null
  const scopeKey = getScopeCacheKey(scope)
  const entryKind = normalizeEntryKind(question?.entry_kind || "standard")
  return `${scopeKey}:${entryKind}`
}

function collectDuplicateKeyErrors(questions: any[]): string[] {
  const scopeEntries = new Map<string, string[]>()

  questions.forEach((question, index) => {
    const scopeKey = getDuplicateKeyScopeKey(question)
    if (!scopeKey) return
    const scopedKeys = scopeEntries.get(scopeKey) ?? []
    scopedKeys.push(resolveIncomingQuestionKey(question, index))
    scopeEntries.set(scopeKey, scopedKeys)
  })

  const errors: string[] = []
  scopeEntries.forEach((keys, scopeKey) => {
    const duplicateKeys = findDuplicateValues(keys.filter(Boolean))
    duplicateKeys.forEach((key) => {
      errors.push(`Duplicate question key "${key}" found in scope ${scopeKey}`)
    })
  })

  return errors
}

function getScopedLegacyQuestionKey(
  entryKind: string | null | undefined,
  legacyQuestionKey: string | null
): string | null {
  if (!legacyQuestionKey) return null
  return `${normalizeEntryKind(entryKind || "standard")}:${legacyQuestionKey}`
}

async function collectOptionSourceErrors(questions: any[]): Promise<string[]> {
  const sourceQuestions = questions.filter((question) => {
    return getQuestionOptionSource(question?.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
  })

  if (sourceQuestions.length === 0) {
    return []
  }

  const errors: string[] = []
  const scopeKeys = new Set<string>()
  sourceQuestions.forEach((question) => {
    const scope = getQuestionScope(question)
    if (!scope) return
    const deptId = scope.kind === "department" ? scope.id : scope.departmentId
    const profKey = scope.kind === "profession" ? scope.departmentProfessionKey : null
    scopeKeys.add(`${deptId}:${profKey || "null"}`)
  })

  // Load scope entry kinds to check supports_assigned_agent capability
  const scopeCapabilities = new Map<string, Set<string>>() // scopeKey -> Set of entry_kinds that support assigned agents

  await Promise.all(
    Array.from(scopeKeys).map(async (scopeKey) => {
      const [deptId, profKey] = scopeKey.split(":")
      const professionKey = profKey === "null" ? null : profKey

      // Query using new target fields (scope_type and profession_role_id)
      const query = (adminSupabase as any)
        .from("scope_entry_kinds")
        .select("entry_kind, supports_assigned_agent")
        .eq("department_id", deptId)

      if (professionKey) {
        // Profession scope: use profession_role_id with scope_type filter
        query.eq("scope_type", "profession_personal").eq("profession_role_id", professionKey)
      } else {
        // Department-wide scope
        query.is("profession_role_id", null)
      }

      const { data: entryKinds, error } = await query

      if (error) {
        console.error(`Error loading scope entry kinds for ${scopeKey}:`, error)
        return
      }

      const supportingKinds = new Set<string>()
      entryKinds?.forEach((k: { entry_kind: string; supports_assigned_agent: boolean }) => {
        if (k.supports_assigned_agent) {
          supportingKinds.add(k.entry_kind.toLowerCase())
        }
      })
      scopeCapabilities.set(scopeKey, supportingKinds)
    })
  )

  sourceQuestions.forEach((question, index) => {
    const scope = getQuestionScope(question)
    if (!scope) {
      errors.push(`Question ${index + 1}: assigned agent questions require a valid scope`)
      return
    }

    if (question.question_type !== "select" && question.question_type !== "multiselect") {
      errors.push(`Question ${index + 1}: assigned agent questions must use the Select or Multi-Select question type`)
    }

    const dailyLimit = getAssignedAgentsDailyLimit(question.metadata)
    const rawDailyLimit = getQuestionOptionSource(question.metadata)?.max_logs_per_agent_per_day
    if (rawDailyLimit !== undefined && rawDailyLimit !== null && dailyLimit === null) {
      errors.push(`Question ${index + 1}: max_logs_per_agent_per_day must be a positive integer or null`)
    }

    if (Array.isArray(question.options) && question.options.length > 0) {
      errors.push(`Question ${index + 1}: assigned agent questions cannot define static options`)
    }

    // Check if the entry kind supports assigned agents
    const deptId = scope.kind === "department" ? scope.id : scope.departmentId
    const profKey = scope.kind === "profession" ? scope.departmentProfessionKey : null
    const capabilityScopeKey = `${deptId}:${profKey || "null"}`

    const entryKind = normalizeEntryKind(question.entry_kind)
    const supportingEntryKinds = scopeCapabilities.get(capabilityScopeKey)

    // If no entry kinds are configured for this scope, allow (graceful degradation)
    if (supportingEntryKinds && supportingEntryKinds.size > 0 && !supportingEntryKinds.has(entryKind)) {
      errors.push(
        `Question ${index + 1}: Entry kind "${entryKind}" does not support assigned agents. ` +
          `Supported entry kinds: ${Array.from(supportingEntryKinds).join(", ")}`
      )
    }
  })

  return errors
}

export async function POST(request: Request) {
  try {
    // Verify admin permission
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Get user for audit fields
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { questions } = body

    // Validate input
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions array is required and must not be empty" }, { status: 400 })
    }

    // Validate each question
    const errors: string[] = []
    questions.forEach((question: any, index: number) => {
      const scope = getQuestionScope(question)
      if (!scope) {
        errors.push(`Question ${index + 1}: department_id is required`)
      }
      if (!question.question_label?.trim()) {
        errors.push(`Question ${index + 1}: question_label is required`)
      }
      if (!question.question_type) {
        errors.push(`Question ${index + 1}: question_type is required`)
      }
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    errors.push(...collectDuplicateKeyErrors(questions))
    errors.push(...(await collectOptionSourceErrors(questions)))

    // Scope-aware entry kind validation with lowercase normalization
    const { errors: entryKindErrors, normalizedQuestions } = await collectEntryKindErrors(questions)
    errors.push(...entryKindErrors)

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    // Prepare questions for insertion (using normalized questions)
    const questionsToInsert = normalizedQuestions.map((question: any, index: number) => {
      const legacyQuestionKey = resolveIncomingQuestionKey(question, index)
      const scope = getQuestionScope(question)
      const entryKind = question.entry_kind || "standard"
      return {
        department_id: scope?.kind === "profession" ? scope.departmentId : (scope?.id ?? null),
        department_profession_id: scope?.kind === "profession" ? scope.departmentProfessionId : null,
        department_role:
          scope?.kind === "profession" ? normalizeSalesPromoterProfessionKey(scope.departmentProfessionKey) : null,
        question_scope_type:
          scope?.kind === "profession"
            ? "profession_personal"
            : scope?.kind === "dept_wide_personal"
              ? "dept_wide_personal"
              : "dept_report",
        entry_kind: entryKind,
        question_label: question.question_label.trim(),
        question_type: question.question_type,
        question_description: question.question_description?.trim() || null,
        placeholder: question.placeholder?.trim() || null,
        options:
          getQuestionOptionSource(question.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
            ? null
            : question.options && question.options.length > 0
              ? question.options
              : null,
        is_required:
          getQuestionOptionSource(question.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
            ? true
            : question.is_required || false,
        display_order: question.display_order ?? index,
        validation_rules: question.validation_rules || null,
        is_active: question.is_active !== false,
        metadata: mergeMetadata(null, question.metadata, legacyQuestionKey),
        created_by: user.id,
        updated_by: user.id,
        min_value: question.min_value ?? null,
        max_value: question.max_value ?? null,
        min_length: question.min_length ?? null,
        max_length: question.max_length ?? null,
        pattern: question.pattern ?? null,
        step: question.step ?? null,
        min_date: question.min_date ?? null,
        max_date: question.max_date ?? null,
      }
    })

    // Insert all questions in a transaction
    const { data: createdQuestions, error: insertError } = await adminSupabase
      .from("role_questions")
      .insert(questionsToInsert as any)
      .select()

    if (insertError) {
      console.error("Error creating questions:", insertError)

      // Handle unique constraint violation
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "One or more questions already exist for this scope", details: insertError.message },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: "Failed to create questions", details: insertError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully created ${createdQuestions?.length || 0} question(s)`,
        data: createdQuestions,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Unexpected error creating questions:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // Verify admin permission
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Get user for audit fields
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { questions } = body

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions array is required and must not be empty" }, { status: 400 })
    }

    const errors: string[] = []
    questions.forEach((question: any, index: number) => {
      const scope = getQuestionScope(question)
      if (!scope) {
        errors.push(
          `Question ${index + 1}: Provide department_id for department reports or department_profession_id for profession questions`
        )
      }
      if (!question.question_label?.trim()) {
        errors.push(`Question ${index + 1}: question_label is required`)
      }
      if (!question.question_type) {
        errors.push(`Question ${index + 1}: question_type is required`)
      }

      if (question.id != null && typeof question.id !== "string") {
        errors.push(`Question ${index + 1}: id must be a string when provided`)
      }
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    errors.push(...collectDuplicateKeyErrors(questions))
    errors.push(...(await collectOptionSourceErrors(questions)))

    // Scope-aware entry kind validation with lowercase normalization
    const { errors: entryKindErrors, normalizedQuestions } = await collectEntryKindErrors(questions)
    errors.push(...entryKindErrors)

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const seenIds = new Set<string>()
    normalizedQuestions.forEach((question: any, index: number) => {
      if (typeof question.id === "string" && question.id) {
        if (seenIds.has(question.id)) {
          errors.push(`Question ${index + 1}: Duplicate id "${question.id}"`)
        }
        seenIds.add(question.id)
      }
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const scopeKeys = Array.from(
      new Set(
        normalizedQuestions
          .map((q: any) => {
            const scope = getQuestionScope(q)
            if (!scope) return null
            return getScopeCacheKey(scope)
          })
          .filter(Boolean)
      )
    ) as string[]
    const savedQuestions: any[] = []

    for (const scopeKey of scopeKeys) {
      const parts = scopeKey.split(":")
      const kind = parts[0]
      const scope:
        | { kind: "dept_report" | "dept_wide_personal"; id: string }
        | {
            kind: "profession"
            departmentId: string
            departmentProfessionId: string | null
            departmentProfessionKey: string | null
          } =
        kind === "dept_report" || kind === "dept_wide_personal"
          ? { kind: kind as any, id: parts[1] }
          : {
              kind: "profession",
              departmentId: parts[1],
              departmentProfessionId: parts[2] !== "unknown" ? parts[2] : null,
              departmentProfessionKey: parts[3] !== "unknown" ? parts[3] : null,
            }
      const scopeQuestions = normalizedQuestions.filter((q: any) => {
        const qScope = getQuestionScope(q)
        if (kind === "dept_report" || kind === "dept_wide_personal") {
          return qScope?.kind === kind && qScope?.id === parts[1]
        } else {
          return (
            qScope?.kind === "profession" &&
            qScope?.departmentId === parts[1] &&
            (qScope?.departmentProfessionId ?? "unknown") === parts[2] &&
            (qScope?.departmentProfessionKey ?? "unknown") === parts[3]
          )
        }
      })

      const targetDepartmentId = scope.kind === "profession" ? scope.departmentId : scope.id
      const { data: existingRows, error: existingError } = await adminSupabase
        .from("role_questions")
        .select("id, metadata, entry_kind, department_id, department_profession_id, department_role")
        .eq("department_id", targetDepartmentId)
        .limit(10000)

      if (existingError) {
        return NextResponse.json(
          { error: "Failed to load existing questions", details: existingError.message },
          { status: 500 }
        )
      }

      const existingById = new Map<string, any>()
      const existingByLegacyKey = new Map<string, any>()
      ;((existingRows || []) as any[])
        .filter((row) => {
          const rowScope = getQuestionScope(row)
          if (scope.kind !== "profession") {
            return rowScope?.kind === scope.kind && rowScope.id === scope.id
          }

          return (
            rowScope?.kind === "profession" &&
            rowScope.departmentId === scope.departmentId &&
            (rowScope.departmentProfessionId ?? null) === scope.departmentProfessionId &&
            (rowScope.departmentProfessionKey ?? null) === scope.departmentProfessionKey
          )
        })
        .forEach((row: any) => {
          if (row?.id) {
            existingById.set(row.id, row)
            const legacyKey = row.metadata?.legacy_question_key
            if (typeof legacyKey === "string" && legacyKey.trim()) {
              existingByLegacyKey.set(
                getScopedLegacyQuestionKey(row.entry_kind, legacyKey.trim()) || legacyKey.trim(),
                row
              )
            }
          }
        })

      const existingIds = new Set(Array.from(existingById.keys()))
      const keepIds = new Set<string>()

      scopeQuestions.forEach((q: any) => {
        if (typeof q.id === "string" && q.id) {
          keepIds.add(q.id)
          return
        }

        const legacyKey = getLegacyQuestionKey(q)
        if (legacyKey) {
          const existing = existingByLegacyKey.get(getScopedLegacyQuestionKey(q.entry_kind, legacyKey) || legacyKey)
          if (existing?.id) {
            keepIds.add(existing.id)
          }
        }
      })

      const toDeleteIds = Array.from(existingIds).filter((id) => !keepIds.has(id))

      if (toDeleteIds.length > 0) {
        const { error: deleteError } = await adminSupabase.from("role_questions").delete().in("id", toDeleteIds)

        if (deleteError) {
          return NextResponse.json(
            { error: "Failed to delete removed questions", details: deleteError.message },
            { status: 500 }
          )
        }
      }

      const questionsToUpsert = scopeQuestions.map((question: any, index: number) => {
        const legacyQuestionKey = resolveIncomingQuestionKey(question, index)
        const resolvedExisting =
          typeof question.id === "string" && question.id
            ? existingById.get(question.id)
            : legacyQuestionKey
              ? existingByLegacyKey.get(
                  getScopedLegacyQuestionKey(question.entry_kind, legacyQuestionKey) || legacyQuestionKey
                )
              : undefined

        const resolvedId = typeof question.id === "string" && question.id ? question.id : resolvedExisting?.id
        const existingMeta = resolvedExisting?.metadata
        const nextMeta = mergeMetadata(existingMeta, question.metadata, legacyQuestionKey)

        const entryKind = question.entry_kind || resolvedExisting?.entry_kind || "standard"

        const base = {
          id: resolvedId ?? randomUUID(),
          department_id: scope.kind === "profession" ? scope.departmentId : scope.id,
          department_profession_id: scope.kind === "profession" ? scope.departmentProfessionId : null,
          department_role:
            scope.kind === "profession" ? normalizeSalesPromoterProfessionKey(scope.departmentProfessionKey) : null,
          question_scope_type:
            scope.kind === "profession"
              ? "profession_personal"
              : scope.kind === "dept_wide_personal"
                ? "dept_wide_personal"
                : "dept_report",
          entry_kind: entryKind,
          question_label: question.question_label.trim(),
          question_type: question.question_type,
          question_description: question.question_description?.trim() || null,
          placeholder: question.placeholder?.trim() || null,
          options:
            getQuestionOptionSource(question.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
              ? null
              : question.options && question.options.length > 0
                ? question.options
                : null,
          is_required:
            getQuestionOptionSource(question.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
              ? true
              : question.is_required || false,
          display_order: question.display_order ?? index,
          validation_rules: question.validation_rules || null,
          is_active: question.is_active !== false,
          metadata: nextMeta,
          updated_by: user.id,
          min_value: question.min_value ?? null,
          max_value: question.max_value ?? null,
          min_length: question.min_length ?? null,
          max_length: question.max_length ?? null,
          pattern: question.pattern ?? null,
          step: question.step ?? null,
          min_date: question.min_date ?? null,
          max_date: question.max_date ?? null,
        }

        if (!resolvedId || !existingIds.has(resolvedId)) {
          return {
            ...base,
            created_by: user.id,
          }
        }

        return base
      })

      const { data: upserted, error: upsertError } = await adminSupabase
        .from("role_questions")
        .upsert(questionsToUpsert as any, { onConflict: "id" })
        .select()

      if (upsertError) {
        console.error("Error saving questions:", upsertError)
        return NextResponse.json({ error: "Failed to save questions", details: upsertError.message }, { status: 500 })
      }

      savedQuestions.push(...(upserted || []))
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully saved ${savedQuestions.length} question(s)`,
        data: savedQuestions,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Unexpected error saving questions:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
