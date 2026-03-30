import { NextResponse } from "next/server"
import { findDuplicateValues, getLegacyQuestionKeyFromMetadata, normalizeQuestionKey } from "@/lib/role-question-identity"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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

function getQuestionScope(
  question: any
): { kind: "department_role"; role: string; departmentId: string | null } | { kind: "department"; id: string } | null {
  const departmentId =
    typeof question?.department_id === "string" && question.department_id ? question.department_id : null
  const departmentRole =
    typeof question?.department_role === "string" && question.department_role ? question.department_role : null

  // Role-scoped: requires department_role, may also have department_id
  if (departmentRole) {
    return { kind: "department_role", role: departmentRole, departmentId }
  }
  // Department-scoped: only department_id
  if (departmentId) {
    return { kind: "department", id: departmentId }
  }
  return null
}

function getScopeCacheKey(scope: NonNullable<ReturnType<typeof getQuestionScope>>): string {
  if (scope.kind === "department") {
    return `${scope.kind}:${scope.id}`
  }

  return `${scope.kind}:${scope.departmentId}:${scope.role}`
}

function resolveIncomingQuestionKey(question: any, index: number): string {
  const directKey = getLegacyQuestionKey(question)
  if (directKey) return directKey

  const normalizedLabel = normalizeQuestionKey(String(question?.question_label ?? ""))
  if (normalizedLabel) return normalizedLabel

  return `question_${index + 1}`
}

function collectDuplicateKeyErrors(questions: any[]): string[] {
  const scopeEntries = new Map<string, string[]>()

  questions.forEach((question, index) => {
    const scope = getQuestionScope(question)
    if (!scope) return

    const scopeKey = getScopeCacheKey(scope)
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

export async function POST(request: Request) {
  try {
    // Temporarily disabled for testing - TODO: Add proper permission check
    // const auth = await verifyPermissionFromRequest(request, "departments.read")
    // if (!auth.ok) {
    //   return NextResponse.json({ error: auth.error }, { status: auth.status })
    // }

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

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    // Prepare questions for insertion
    const questionsToInsert = questions.map((question: any, index: number) => {
      const legacyQuestionKey = resolveIncomingQuestionKey(question, index)
      const scope = getQuestionScope(question)
      return {
        department_id: scope?.kind === "department" ? scope.id : (scope?.departmentId ?? null),
        department_role: scope?.kind === "department_role" ? scope.role : null,
        question_label: question.question_label.trim(),
        question_type: question.question_type,
        question_description: question.question_description?.trim() || null,
        placeholder: question.placeholder?.trim() || null,
        options: question.options && question.options.length > 0 ? question.options : null,
        is_required: question.is_required || false,
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
    // Temporarily disabled for testing - TODO: Add proper permission check
    // const auth = await verifyPermissionFromRequest(request, "departments.read")
    // if (!auth.ok) {
    //   return NextResponse.json({ error: auth.error }, { status: auth.status })
    // }

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
          `Question ${index + 1}: Provide department_id for department scope or department_role for role scope`
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

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const seenIds = new Set<string>()
    questions.forEach((question: any, index: number) => {
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
        questions
          .map((q: any) => {
            const scope = getQuestionScope(q)
            if (!scope) return null
            if (scope.kind === "department") {
              return `${scope.kind}:${scope.id}`
            }
            return `${scope.kind}:${scope.departmentId}:${scope.role}`
          })
          .filter(Boolean)
      )
    ) as string[]
    const savedQuestions: any[] = []

    for (const scopeKey of scopeKeys) {
      const parts = scopeKey.split(":")
      const kind = parts[0]
      const scope:
        | { kind: "department"; id: string }
        | { kind: "department_role"; departmentId: string; role: string } =
        kind === "department"
          ? { kind: "department", id: parts[1] }
          : { kind: "department_role", departmentId: parts[1], role: parts[2] }
      const scopeQuestions = questions.filter((q: any) => {
        const qScope = getQuestionScope(q)
        if (kind === "department") {
          return qScope?.kind === "department" && qScope?.id === parts[1]
        } else {
          return qScope?.kind === "department_role" && qScope?.role === parts[2] && qScope?.departmentId === parts[1]
        }
      })

      let existingQuery = adminSupabase.from("role_questions").select("id, metadata")

      if (scope.kind === "department_role") {
        existingQuery = existingQuery.eq("department_id", scope.departmentId).eq("department_role", scope.role)
      } else {
        existingQuery = existingQuery.eq("department_id", scope.id).is("department_role", null)
      }

      const { data: existingRows, error: existingError } = await existingQuery.limit(10000)

      if (existingError) {
        return NextResponse.json(
          { error: "Failed to load existing questions", details: existingError.message },
          { status: 500 }
        )
      }

      const existingById = new Map<string, any>()
      const existingByLegacyKey = new Map<string, any>()
      ;(existingRows || []).forEach((row: any) => {
        if (row?.id) {
          existingById.set(row.id, row)
          const legacyKey = row.metadata?.legacy_question_key
          if (typeof legacyKey === "string" && legacyKey.trim()) {
            existingByLegacyKey.set(legacyKey.trim(), row)
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
          const existing = existingByLegacyKey.get(legacyKey)
          if (existing?.id) {
            keepIds.add(existing.id)
          }
        }
      })

      const toDeleteIds = Array.from(existingIds).filter((id) => !keepIds.has(id))

      if (toDeleteIds.length > 0) {
        let query = adminSupabase.from("role_questions").delete()

        if (scope.kind === "department_role") {
          query = query.eq("department_id", scope.departmentId).eq("department_role", scope.role)
        } else {
          query = query.eq("department_id", scope.id).is("department_role", null)
        }

        const { error: deleteError } = await query.in("id", toDeleteIds)

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
              ? existingByLegacyKey.get(legacyQuestionKey)
              : undefined

        const resolvedId = typeof question.id === "string" && question.id ? question.id : resolvedExisting?.id
        const existingMeta = resolvedExisting?.metadata
        const nextMeta = mergeMetadata(existingMeta, question.metadata, legacyQuestionKey)

        const base = {
          ...(resolvedId ? { id: resolvedId } : {}),
          department_id: scope.kind === "department" ? scope.id : scope.departmentId,
          department_role: scope.kind === "department_role" ? scope.role : null,
          question_label: question.question_label.trim(),
          question_type: question.question_type,
          question_description: question.question_description?.trim() || null,
          placeholder: question.placeholder?.trim() || null,
          options: question.options && question.options.length > 0 ? question.options : null,
          is_required: question.is_required || false,
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
