import { useState, useEffect, useRef } from 'react'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import { toast } from 'sonner'
import { apiFetch, getErrorMessage } from '@/lib/api-client'

export interface RoleQuestion {
  id: string
  role_id: string
  question_key: string
  question_label: string
  question_title?: string | null
  question_type: 'text' | 'textarea' | 'email' | 'url' | 'phone' | 'select' | 'multiselect' | 'checkbox' | 'number' | 'date' | 'time' | 'datetime' | 'daterange' | 'duration' | 'priority' | 'status' | 'radio' | 'tags' | 'rating' | 'slider' | 'nps' | 'file' | 'image' | 'rich-text' | 'currency' | 'percentage'
  question_description?: string | null
  placeholder?: string | null
  options?: any
  is_required: boolean
  display_order: number
  validation_rules?: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useRoleQuestions(initialQuestions?: RoleQuestion[], departmentId?: string) {
  const { user, profile } = useSupabaseAuth()
  const [questions, setQuestions] = useState<RoleQuestion[]>(initialQuestions ?? [])
  const [isLoading, setIsLoading] = useState(!initialQuestions)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastFetchRef = useRef<{ userId: string | undefined; roleId: string | undefined; departmentId?: string } | null>(null)
  const lastToastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setIsLoading(false)
      setQuestions(initialQuestions)
      return
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const fetchQuestions = async () => {
      if (!user || !profile) {
        setIsLoading(false)
        setQuestions([])
        return
      }

      // For report question loading, department context is required.
      // Treat "no department selected yet" as an idle state (not an error).
      if (!departmentId) {
        setIsLoading(false)
        setError(null)
        setQuestions([])
        lastFetchRef.current = { userId: user.id, roleId: profile.role_id, departmentId }
        return
      }

      // Prevent duplicate requests for the same user/role
      const currentKey = { userId: user.id, roleId: profile.role_id, departmentId }
      if (
        lastFetchRef.current &&
        lastFetchRef.current.userId === currentKey.userId &&
        lastFetchRef.current.roleId === currentKey.roleId &&
        lastFetchRef.current.departmentId === currentKey.departmentId
      ) {
        // Already fetched for this user/role, skip
        setIsLoading(false)
        return
      }

      // Create new abort controller for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        setIsLoading(true)
        setError(null)

        const qs = new URLSearchParams()
        qs.set('forReport', 'true')
        if (departmentId) {
          qs.set('departmentId', departmentId)
        }

        const url = qs.toString() ? `/api/role-questions?${qs.toString()}` : '/api/role-questions'

        const data = await apiFetch<RoleQuestion[]>(url, {
          signal: abortController.signal,
        })
        const fetchedQuestions = Array.isArray(data) ? data : []
        setQuestions(fetchedQuestions)
        lastFetchRef.current = currentKey
        lastToastKeyRef.current = null
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Error fetching role questions:', err)

        const key = `${user.id}:${profile.role_id}:${departmentId || ''}`
        const message = getErrorMessage(err, 'Failed to load questions')
        setError(message)
        if (lastToastKeyRef.current !== key) {
          toast.error(message)
          lastToastKeyRef.current = key
        }
        setQuestions([])
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchQuestions()

    // Cleanup: abort request on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [user?.id, profile?.role_id, departmentId]) // Use specific properties instead of whole objects

  // Convert database questions to the format expected by RoleBasedQuestionFields
  // and include a separate title field (backed by question_title, falling back to label)
  const formattedQuestions = questions.map(q => ({
    id: q.id, // Include the database ID for proper response creation
    key: q.question_key,
    label: q.question_label,
    title: q.question_title || q.question_label,
    type: q.question_type,
    description: q.question_description || undefined,
    placeholder: q.placeholder || undefined,
    options: q.options || undefined,
    required: q.is_required,
    order: q.display_order,
    validationRules: q.validation_rules || undefined,
    defaultValue: q.question_type === 'checkbox' ? false : 
                  q.question_type === 'multiselect' ? [] : 
                  undefined,
  }))

  return {
    questions: formattedQuestions.sort((a, b) => a.order - b.order),
    isLoading,
    error,
  }
}


