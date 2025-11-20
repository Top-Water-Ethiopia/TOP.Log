import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { isAdmin: false, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, error: 'Admin access required' }
  }

  const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile.role_id === ADMIN_ROLE_ID

  if (!isSuperAdmin && !isAdmin) {
    return { isAdmin: false, error: 'Admin access required' }
  }

  return { isAdmin: true, userId: user.id }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { questions } = body

    // Validate input
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Questions array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each question
    const errors: string[] = []
    questions.forEach((question: any, index: number) => {
      if (!question.role_id) {
        errors.push(`Question ${index + 1}: role_id is required`)
      }
      if (!question.question_key?.trim()) {
        errors.push(`Question ${index + 1}: question_key is required`)
      }
      if (!question.question_label?.trim()) {
        errors.push(`Question ${index + 1}: question_label is required`)
      }
      if (!question.question_type) {
        errors.push(`Question ${index + 1}: question_type is required`)
      }
      
      // Validate question_key format
      if (question.question_key && !/^[a-z0-9_]+$/.test(question.question_key)) {
        errors.push(`Question ${index + 1}: question_key must contain only lowercase letters, numbers, and underscores`)
      }
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    // Check for duplicate question_keys within the same role
    const roleQuestionKeys = new Map<string, Set<string>>()
    questions.forEach((question: any) => {
      const roleId = question.role_id
      const questionKey = question.question_key.trim()
      
      if (!roleQuestionKeys.has(roleId)) {
        roleQuestionKeys.set(roleId, new Set())
      }
      
      const keys = roleQuestionKeys.get(roleId)!
      if (keys.has(questionKey)) {
        errors.push(`Duplicate question_key "${questionKey}" for role ${roleId}`)
      } else {
        keys.add(questionKey)
      }
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    // Check for existing question_keys in database for each role
    const roleIds = Array.from(new Set(questions.map((q: any) => q.role_id)))
    for (const roleId of roleIds) {
      const roleQuestions = questions.filter((q: any) => q.role_id === roleId)
      const questionKeys = roleQuestions.map((q: any) => q.question_key.trim())
      
      const { data: existing, error: checkError } = await adminSupabase
        .from('role_questions')
        .select('question_key')
        .eq('role_id', roleId)
        .in('question_key', questionKeys)
      
      if (checkError) {
        return NextResponse.json(
          { error: 'Failed to check existing questions', details: checkError.message },
          { status: 500 }
        )
      }
      
      if (existing && existing.length > 0) {
        const existingKeys = existing.map((q: any) => q.question_key)
        return NextResponse.json(
          { 
            error: 'Some question keys already exist for this role', 
            details: `Duplicate keys: ${existingKeys.join(', ')}` 
          },
          { status: 409 }
        )
      }
    }

    // Prepare questions for insertion
    const questionsToInsert = questions.map((question: any, index: number) => ({
      role_id: question.role_id,
      question_key: question.question_key.trim(),
      question_label: question.question_label.trim(),
      question_type: question.question_type,
      question_description: question.question_description?.trim() || null,
      placeholder: question.placeholder?.trim() || null,
      options: question.options && question.options.length > 0 ? question.options : null,
      is_required: question.is_required || false,
      display_order: question.display_order ?? index,
      validation_rules: question.validation_rules || null,
      is_active: question.is_active !== false,
      // Advanced features - TODO: Uncomment after migration 20251118020000_enhance_questions_advanced_features.sql is applied
      // help_text: question.help_text?.trim() || null,
      // default_value: question.default_value?.trim() || null,
      // min_value: question.min_value || null,
      // max_value: question.max_value || null,
      // min_length: question.min_length || null,
      // max_length: question.max_length || null,
      // pattern: question.pattern?.trim() || null,
      // step: question.step || null,
      // min_date: question.min_date || null,
      // max_date: question.max_date || null,
      // conditional_logic: question.conditional_logic || null,
      created_by: userId,
      updated_by: userId,
      }))

    // Insert all questions in a transaction
    const { data: createdQuestions, error: insertError } = await adminSupabase
      .from('role_questions')
      .insert(questionsToInsert)
      .select()

    if (insertError) {
      console.error('Error creating questions:', insertError)
      
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'One or more question keys already exist for this role', details: insertError.message },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create questions', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdQuestions?.length || 0} question(s)`,
      data: createdQuestions,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error creating questions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

