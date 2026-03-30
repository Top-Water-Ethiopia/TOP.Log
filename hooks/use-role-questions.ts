import { useState, useMemo } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { toast } from "sonner"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import useSWR from "swr"

export interface RoleQuestion {
  id: string
  role_id: string | null
  department_id?: string | null
  question_key: string // Added this line
  question_label: string
  question_type:
    | "text"
    | "textarea"
    | "email"
    | "url"
    | "phone"
    | "select"
    | "multiselect"
    | "checkbox"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "daterange"
    | "duration"
    | "priority"
    | "status"
    | "radio"
    | "tags"
    | "rating"
    | "slider"
    | "nps"
    | "file"
    | "image"
    | "rich-text"
    | "currency"
    | "percentage"
  question_description?: string | null
  placeholder?: string | null
  options?: unknown
  is_required: boolean
  display_order: number
  validation_rules?: unknown
  is_active: boolean
  created_at: string
  updated_at: string
}

// SWR fetcher for role questions
const roleQuestionsFetcher = async (url: string): Promise<RoleQuestion[]> => {
  const data = await apiFetch<RoleQuestion[]>(url)
  return Array.isArray(data) ? data : []
}

export function useRoleQuestions(initialQuestions?: RoleQuestion[], departmentId?: string) {
  const { user, profile } = useSupabaseAuth()
  const userId = user?.id
  const profileRoleId = profile?.role_id

  // Build the SWR key based on dependencies
  const swrKey = useMemo(() => {
    if (!userId || !profileRoleId || !departmentId) return null
    if (initialQuestions && initialQuestions.length > 0) return null

    const qs = new URLSearchParams()
    qs.set("forReport", "true")
    qs.set("departmentId", departmentId)

    return `/api/role-questions?${qs.toString()}`
  }, [userId, profileRoleId, departmentId, initialQuestions])

  const { data, error, isLoading } = useSWR(swrKey, roleQuestionsFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    fallbackData: initialQuestions ?? [],
    onError: (err) => {
      const message = getErrorMessage(err, "Failed to load questions")
      toast.error(message)
    },
  })

  // Use state for optimistic updates while SWR loads
  const [questions] = useState<RoleQuestion[]>(initialQuestions ?? [])

  const effectiveQuestions = data ?? questions

  // Convert database questions to the format expected by RoleBasedQuestionFields
  const formattedQuestions = useMemo(() => {
    return effectiveQuestions.map((q) => ({
      id: q.id,
      key: q.question_key || q.id,
      label: q.question_label,
      title: q.question_label,
      type: q.question_type,
      description: q.question_description || undefined,
      placeholder: q.placeholder || undefined,
      options: q.options || undefined,
      required: q.is_required,
      order: q.display_order,
      validationRules: q.validation_rules || undefined,
      defaultValue: q.question_type === "checkbox" ? false : q.question_type === "multiselect" ? [] : undefined,
    }))
  }, [effectiveQuestions])

  return {
    questions: formattedQuestions.sort((a, b) => a.order - b.order),
    isLoading: isLoading || (!!swrKey && !data && !error),
    error: error ? getErrorMessage(error, "Failed to load questions") : null,
  }
}
