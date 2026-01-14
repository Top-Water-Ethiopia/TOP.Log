import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

function getLegacyQuestionKey(question: any): string | null {
  if (typeof question?.question_key === "string") {
    const trimmed = question.question_key.trim()
    return trimmed ? trimmed : null
  }
  return null
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

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false, error: "Admin access required" }
  }

  return { isAdmin: true, userId: user.id }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
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
      if (!question.role_id) {
        errors.push(`Question ${index + 1}: role_id is required`)
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

    // Prepare questions for insertion
    const questionsToInsert = questions.map((question: any, index: number) => {
      const legacyQuestionKey = getLegacyQuestionKey(question)
      return {
        role_id: question.role_id,
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
        created_by: userId,
        updated_by: userId,
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
          { error: "One or more question keys already exist for this role", details: insertError.message },
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
    const { isAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { questions } = body

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions array is required and must not be empty" }, { status: 400 })
    }

    const errors: string[] = []
    questions.forEach((question: any, index: number) => {
      if (!question.role_id) {
        errors.push(`Question ${index + 1}: role_id is required`)
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

    const roleIds = Array.from(new Set(questions.map((q: any) => q.role_id)))
    const savedQuestions: any[] = []

    for (const roleId of roleIds) {
      const roleQuestions = questions.filter((q: any) => q.role_id === roleId)

      const { data: existingRows, error: existingError } = await adminSupabase
        .from("role_questions")
        .select("id, metadata")
        .eq("role_id", roleId)
        .limit(10000)

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

      roleQuestions.forEach((q: any) => {
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
        const { error: deleteError } = await adminSupabase
          .from("role_questions")
          .delete()
          .eq("role_id", roleId)
          .in("id", toDeleteIds)

        if (deleteError) {
          return NextResponse.json(
            { error: "Failed to delete removed questions", details: deleteError.message },
            { status: 500 }
          )
        }
      }

      const questionsToUpsert = roleQuestions.map((question: any, index: number) => {
        const legacyQuestionKey = getLegacyQuestionKey(question)
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
          role_id: question.role_id,
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
          updated_by: userId,
        }

        if (!resolvedId || !existingIds.has(resolvedId)) {
          return {
            ...base,
            created_by: userId,
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
