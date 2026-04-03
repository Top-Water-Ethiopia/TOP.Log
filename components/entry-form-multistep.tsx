"use client"

import Link from "next/link"
import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { Matcher } from "react-day-picker"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useAuth } from "@/contexts/auth-context"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useRoleQuestions, type RoleQuestion } from "@/hooks/use-role-questions"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { DateRestrictionBanner, QuickDateChips } from "@/components/features/daily-log/molecules"
import type { CustomQuestion, QuestionResponse } from "@/lib/rbac/types"
import { getQuestionReactKey } from "@/lib/role-question-identity"
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Eye,
  AlertCircle,
  ListChecks,
  Pencil,
  CalendarDays,
  Lock,
  Loader2,
  MapPin,
  Phone,
  Search,
  X,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  canCreateEntryForDate,
  formatLocalDate,
  formatDateHuman,
  getAllowedDates,
  getDateRestrictionMessage,
  getToday,
} from "@/lib/date-restrictions"
import {
  ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
  type AssignedAgentOption,
  parseAgentResponseValue,
} from "@/lib/marketing-agents"

interface EntryFormMultistepProps {
  date?: string
  departmentId: string
  departmentName?: string
  allowedDates?: string[]
  initialExistingStandardEntryId?: string | null
  onDateChange?: (date: string) => void
  onSave: (result?: { entryKind: "standard" | "agent_call"; date: string }) => void
  onCancel: (selectedDate?: string) => void
  stayOnAgentCallSave?: boolean
  initialRoleQuestions?: unknown[]
}

const EMPTY_FORM_DATA = {
  objectives: "",
  keyResults: "",
  challenges: "",
  developmentTasks: "",
  featuresCompleted: "",
  challengesAndBlockers: "",
  codeAndPriorities: "",
  systemImprovements: "",
  projectUpdates: "",
}

type FormQuestion = {
  id?: string
  key: string
  label: string
  title?: string
  type: string
  description?: string
  placeholder?: string
  options?: unknown
  category?: string
  required: boolean
  order: number
  validationRules?: unknown
  defaultValue?: unknown
  metadata?: unknown
  optionSourceKind?: string
}

export function EntryFormMultistep({
  date: initialDate,
  departmentId,
  departmentName,
  allowedDates,
  initialExistingStandardEntryId,
  onDateChange,
  onSave,
  onCancel,
  stayOnAgentCallSave = false,
  initialRoleQuestions,
}: EntryFormMultistepProps) {
  const { addEntry } = useCaptainLog()
  const { isAuthenticated, user } = useAuth()
  const { user: supabaseUser } = useSupabaseAuth() // Supabase authentication
  const { validateResponse, processResponses } = useRBAC()
  const { questions: roleQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(
    initialRoleQuestions as RoleQuestion[] | undefined,
    departmentId
  )
  const roleQuestionsRef = useRef(roleQuestions)
  const quickPickDates = useMemo(() => {
    if (Array.isArray(allowedDates) && allowedDates.length > 0) {
      return allowedDates
    }
    return getAllowedDates()
  }, [allowedDates])
  const roleQuestionsSignature = useMemo(() => {
    return roleQuestions
      .map((q) => {
        if (!q || typeof q !== "object") return ""
        const key = (q as { key?: unknown }).key
        const type = (q as { type?: unknown }).type
        const required = (q as { required?: unknown }).required
        const defaultValue = (q as { defaultValue?: unknown }).defaultValue
        return `${String(key ?? "")}:${String(type ?? "")}:${String(!!required)}:${String(defaultValue ?? "")}`
      })
      .join("|")
  }, [roleQuestions])
  const normalizedDepartmentName = departmentName?.trim() || "Department"
  const hasVisibleQuestions = roleQuestions.length > 0
  const assignedAgentsQuestion = useMemo(
    () =>
      roleQuestions.find(
        (question) => (question as FormQuestion).optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
      ) as FormQuestion | undefined,
    [roleQuestions]
  )
  const hasAssignedAgentsQuestion = !!assignedAgentsQuestion
  const hasDepartmentReportQuestions = useMemo(
    () => roleQuestions.some((question) => (question as FormQuestion).category === "department_report"),
    [roleQuestions]
  )
  const departmentReportQuestions = useMemo(
    () => roleQuestions.filter((question) => (question as FormQuestion).category === "department_report") as FormQuestion[],
    [roleQuestions]
  )
  const professionQuestions = useMemo(
    () =>
      roleQuestions.filter((question) => (question as FormQuestion).category !== "department_report") as FormQuestion[],
    [roleQuestions]
  )

  useEffect(() => {
    roleQuestionsRef.current = roleQuestions
  }, [roleQuestions])

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && canCreateEntryForDate(initialDate).isValid) {
      return initialDate
    }
    return getToday()
  })
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  useEffect(() => {
    if (initialDate && canCreateEntryForDate(initialDate).isValid) {
      setSelectedDate((currentDate) => (currentDate === initialDate ? currentDate : initialDate))
    }
  }, [initialDate])

  const [formData, setFormData] = useState({
    ...EMPTY_FORM_DATA,
  })
  const [customResponses, setCustomResponses] = useState<Record<string, unknown>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const [dateError, setDateError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [assignedAgents, setAssignedAgents] = useState<AssignedAgentOption[]>([])
  const [isAssignedAgentsLoading, setIsAssignedAgentsLoading] = useState(false)
  const [assignedAgentsError, setAssignedAgentsError] = useState<string | null>(null)
  const [assignedAgentsSearch, setAssignedAgentsSearch] = useState("")
  const [assignedAgentsReloadKey, setAssignedAgentsReloadKey] = useState(0)
  const [existingStandardEntryId, setExistingStandardEntryId] = useState<string | null>(
    initialExistingStandardEntryId ?? null
  )
  const [isEntryAvailabilityLoading, setIsEntryAvailabilityLoading] = useState(false)
  const [entryAvailabilityError, setEntryAvailabilityError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [wasDraftRestored, setWasDraftRestored] = useState(false)
  const [agentCallSuccessMessage, setAgentCallSuccessMessage] = useState<string | null>(null)

  const selectedDateAsDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00")
    return Number.isNaN(d.getTime()) ? undefined : d
  }, [selectedDate])

  const isSelectedDateLockedForEdits = useMemo(() => {
    return !canCreateEntryForDate(selectedDate).isValid
  }, [selectedDate])

  const userIdForDraft = useMemo(() => {
    const userWithId = user as unknown as { id?: unknown; email?: unknown }
    const id = typeof userWithId?.id === "string" ? userWithId.id : null
    const email = typeof userWithId?.email === "string" ? userWithId.email : null
    return supabaseUser?.id || id || email || "anon"
  }, [supabaseUser?.id, user])

  const draftKeyPrefix = useMemo(() => {
    return `dailyLogDraft:v1:${userIdForDraft}:${departmentId}:`
  }, [departmentId, userIdForDraft])

  const draftKeyForDate = useCallback(
    (date: string) => {
      return `${draftKeyPrefix}${date}`
    },
    [draftKeyPrefix]
  )

  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true)
    setAgentCallSuccessMessage(null)
  }, [])

  const handleDateSelection = useCallback(
    (newDate: string) => {
      if (newDate === selectedDate) {
        return
      }

      setSelectedDate(newDate)
      setAssignedAgentsSearch("")
      markAsChanged()
      onDateChange?.(newDate)

      const validation = canCreateEntryForDate(newDate)
      setDateError(validation.isValid ? null : validation.error || "Invalid date")
    },
    [markAsChanged, onDateChange, selectedDate]
  )

  const roleQuestionsSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {}
    roleQuestions.forEach((q) => {
      const question = q as unknown as { key?: unknown; label?: unknown; required?: unknown; type?: unknown }
      const key = typeof question.key === "string" ? question.key : null
      const label = typeof question.label === "string" ? question.label : "Field"
      const required = !!question.required
      const type = typeof question.type === "string" ? question.type : "text"

      if (!key) return

      if (!required) {
        shape[key] = z.unknown().optional()
        return
      }

      shape[key] = z.unknown().refine(
        (value) => {
          if (type === "checkbox") {
            return value === true
          }
          if (Array.isArray(value)) {
            return value.length > 0
          }
          if (typeof value === "string") {
            return value.trim().length > 0
          }
          if (typeof value === "number") {
            return !Number.isNaN(value)
          }
          return value !== null && value !== undefined
        },
        { message: `${label} is required` }
      )
    })
    return z.object(shape)
  }, [roleQuestions])

  const getZodErrors = useCallback(
    (responses: Record<string, unknown>) => {
      const result = roleQuestionsSchema.safeParse(responses)
      if (result.success) return {}

      const errors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]
        if (typeof key === "string" && !errors[key]) {
          errors[key] = issue.message
        }
      })
      return errors
    },
    [roleQuestionsSchema]
  )

  const draftSavedLabel = useMemo(() => {
    if (!draftSavedAt) return null
    const d = new Date(draftSavedAt)
    if (Number.isNaN(d.getTime())) return "Saved"
    return `Saved ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }, [draftSavedAt])

  const reportedAssignedAgentsCount = useMemo(
    () => assignedAgents.filter((agent) => agent.alreadyReported).length,
    [assignedAgents]
  )
  const availableAssignedAgents = useMemo(
    () => assignedAgents.filter((agent) => !agent.alreadyReported),
    [assignedAgents]
  )
  const assignedAgentQuestionKey = assignedAgentsQuestion?.key
  const selectedAssignedAgentResponse = assignedAgentQuestionKey
    ? customResponses[String(assignedAgentQuestionKey)]
    : undefined
  const selectedAssignedAgentId = useMemo(() => {
    return parseAgentResponseValue(selectedAssignedAgentResponse)?.value ?? null
  }, [selectedAssignedAgentResponse])
  const selectedAssignedAgent = useMemo(
    () => assignedAgents.find((agent) => agent.id === selectedAssignedAgentId) ?? null,
    [assignedAgents, selectedAssignedAgentId]
  )
  const noAvailableAssignedAgents =
    hasAssignedAgentsQuestion && !isAssignedAgentsLoading && !assignedAgentsError && availableAssignedAgents.length === 0
  const existingStandardEntryHref = existingStandardEntryId ? `/reports/${existingStandardEntryId}` : null
  const hasStandardEntryConflict = !hasAssignedAgentsQuestion && !!existingStandardEntryId
  const filteredAssignedAgents = useMemo(() => {
    const search = assignedAgentsSearch.trim().toLowerCase()
    if (!search) {
      return availableAssignedAgents
    }

    return availableAssignedAgents.filter((agent) =>
      [agent.name, agent.location, agent.phone]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(search))
    )
  }, [assignedAgentsSearch, availableAssignedAgents])
  const noMatchingAssignedAgents =
    hasAssignedAgentsQuestion &&
    !isAssignedAgentsLoading &&
    !assignedAgentsError &&
    availableAssignedAgents.length > 0 &&
    filteredAssignedAgents.length === 0

  useEffect(() => {
    setExistingStandardEntryId((currentValue) => {
      const nextValue = initialExistingStandardEntryId ?? null
      return currentValue === nextValue ? currentValue : nextValue
    })
  }, [initialExistingStandardEntryId])

  useEffect(() => {
    if (!hasAssignedAgentsQuestion) {
      setAssignedAgents([])
      setAssignedAgentsError(null)
      setIsAssignedAgentsLoading(false)
      setAssignedAgentsSearch("")
      return
    }

    const dateValidation = canCreateEntryForDate(selectedDate)
    if (!dateValidation.isValid) {
      setAssignedAgents([])
      setAssignedAgentsError(dateValidation.error || "Assigned agents are unavailable for this date")
      setIsAssignedAgentsLoading(false)
      return
    }

    const controller = new AbortController()
    const loadAssignedAgents = async () => {
      try {
        setIsAssignedAgentsLoading(true)
        setAssignedAgentsError(null)

        const response = await fetch(
          `/api/reporting/assigned-agents?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(selectedDate)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string" ? payload.error : `Failed to load assigned agents (HTTP ${response.status})`
          )
        }

        const nextAgents = Array.isArray(payload?.data) ? (payload.data as AssignedAgentOption[]) : []
        setAssignedAgents(nextAgents)
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        console.error("Failed to load assigned agents:", error)
        setAssignedAgents([])
        setAssignedAgentsError(error instanceof Error ? error.message : "Failed to load assigned agents")
      } finally {
        if (!controller.signal.aborted) {
          setIsAssignedAgentsLoading(false)
        }
      }
    }

    void loadAssignedAgents()

    return () => {
      controller.abort()
    }
  }, [assignedAgentsReloadKey, departmentId, hasAssignedAgentsQuestion, selectedDate])

  useEffect(() => {
    if (hasAssignedAgentsQuestion) {
      setExistingStandardEntryId(null)
      setEntryAvailabilityError(null)
      setIsEntryAvailabilityLoading(false)
      return
    }

    const dateValidation = canCreateEntryForDate(selectedDate)
    if (!dateValidation.isValid) {
      setExistingStandardEntryId(null)
      setEntryAvailabilityError(dateValidation.error || "Report availability is unavailable for this date")
      setIsEntryAvailabilityLoading(false)
      return
    }

    const controller = new AbortController()

    const loadEntryAvailability = async () => {
      try {
        setIsEntryAvailabilityLoading(true)
        setEntryAvailabilityError(null)

        const response = await fetch(
          `/api/reporting/entry-availability?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(selectedDate)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `Failed to check report availability (HTTP ${response.status})`
          )
        }

        setExistingStandardEntryId(
          typeof payload?.data?.existingStandardEntryId === "string" ? payload.data.existingStandardEntryId : null
        )
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        console.error("Failed to load entry availability:", error)
        setExistingStandardEntryId(null)
        setEntryAvailabilityError(error instanceof Error ? error.message : "Failed to check report availability")
      } finally {
        if (!controller.signal.aborted) {
          setIsEntryAvailabilityLoading(false)
        }
      }
    }

    void loadEntryAvailability()

    return () => {
      controller.abort()
    }
  }, [departmentId, hasAssignedAgentsQuestion, selectedDate])

  useEffect(() => {
    if (!assignedAgentQuestionKey || isAssignedAgentsLoading || assignedAgentsError) {
      return
    }

    const selectedValue = parseAgentResponseValue(customResponses[String(assignedAgentQuestionKey)])?.value ?? null
    if (!selectedValue) {
      return
    }

    const isStillAvailable = availableAssignedAgents.some((agent) => agent.id === selectedValue)
    if (isStillAvailable) {
      return
    }

    setCustomResponses((prev) => ({
      ...prev,
      [String(assignedAgentQuestionKey)]: "",
    }))
    setCustomErrors((prev) => ({
      ...prev,
      [String(assignedAgentQuestionKey)]: "",
    }))
    setLiveMessage("Selected agent is no longer available for this date")
  }, [
    assignedAgentQuestionKey,
    assignedAgentsError,
    availableAssignedAgents,
    customResponses,
    isAssignedAgentsLoading,
  ])

  const getAssignedAgentValidationError = useCallback(
    (question: FormQuestion | undefined, value: unknown) => {
      if (!question || question.optionSourceKind !== ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
        return null
      }

      if (isAssignedAgentsLoading) {
        return "Assigned agents are still loading"
      }

      if (assignedAgentsError) {
        return assignedAgentsError
      }

      if (assignedAgents.length === 0) {
        return "No agents are assigned to you yet."
      }

      if (availableAssignedAgents.length === 0) {
        return "All assigned agents already have a call report for this date."
      }

      const selectedValue = parseAgentResponseValue(value)?.value ?? null
      if (!selectedValue) {
        return question.required ? `${question.label} is required` : null
      }

      const matchedAgent = assignedAgents.find((agent) => agent.id === selectedValue)
      if (!matchedAgent) {
        return "Select a valid assigned agent"
      }

      if (matchedAgent.alreadyReported) {
        return "A call report for this agent already exists on this date."
      }

      return null
    },
    [assignedAgents, assignedAgentsError, availableAssignedAgents.length, isAssignedAgentsLoading]
  )

  const buildInitialCustomResponses = useCallback((existingResponses?: QuestionResponse[]) => {
    const responseMap: Record<string, unknown> = {}

    roleQuestionsRef.current.forEach((question) => {
      const q = question as Record<string, unknown>
      const existing = existingResponses?.find(
        (response) => response.questionId === q.id || response.questionKey === q.key
      )

      if (existing) {
        responseMap[String(q.key)] = existing.value
      } else if (q.defaultValue !== undefined) {
        responseMap[String(q.key)] = q.defaultValue
      } else if (q.type === "multiselect") {
        responseMap[String(q.key)] = []
      } else if (q.type === "checkbox") {
        responseMap[String(q.key)] = false
      } else {
        responseMap[String(q.key)] = ""
      }
    })

    return responseMap
  }, [])

  // Initialize create-only form state for the selected date, optionally merged with a local draft.
  useEffect(() => {
    let draft: unknown = null
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(draftKeyForDate(selectedDate))
        if (raw) {
          draft = JSON.parse(raw) as unknown
        }
      } catch {
        draft = null
      }
    }

    const draftObj = draft as {
      version?: unknown
      savedAt?: unknown
      formData?: unknown
      customResponses?: unknown
      currentStep?: unknown
    } | null

    const hasDraft = !!draftObj && draftObj.version === 1

    if (hasDraft && typeof draftObj?.savedAt === "string") {
      setDraftSavedAt(draftObj.savedAt)
    } else {
      setDraftSavedAt(null)
    }
    setWasDraftRestored(hasDraft)

    const baseFormData = {
      ...EMPTY_FORM_DATA,
    }
    const baseResponses = buildInitialCustomResponses()
    const maxStep = roleQuestionsRef.current.length + 2
    const restoredStep =
      hasDraft && typeof draftObj?.currentStep === "number"
        ? Math.min(Math.max(1, Math.trunc(draftObj.currentStep)), maxStep)
        : 1

    const mergedFormData =
      hasDraft && draftObj?.formData && typeof draftObj.formData === "object"
        ? { ...baseFormData, ...(draftObj.formData as Record<string, unknown>) }
        : baseFormData
    const mergedResponses =
      hasDraft && draftObj?.customResponses && typeof draftObj.customResponses === "object"
        ? { ...baseResponses, ...(draftObj.customResponses as Record<string, unknown>) }
        : baseResponses

    setFormData(mergedFormData as typeof formData)
    setCustomResponses(mergedResponses as Record<string, unknown>)
    setCurrentStep(restoredStep)
    setCustomErrors({})
    setHasUnsavedChanges(false)
    setAgentCallSuccessMessage(null)
  }, [selectedDate, buildInitialCustomResponses, draftKeyForDate, roleQuestionsSignature])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const errors = getZodErrors(customResponses)
      roleQuestions.forEach((question) => {
        const typedQuestion = question as FormQuestion
        const agentError = getAssignedAgentValidationError(typedQuestion, customResponses[String(typedQuestion.key)])
        if (agentError) {
          errors[String(typedQuestion.key)] = agentError
        }
      })
      setCustomErrors(errors)

      if (Object.keys(errors).length > 0) {
        setLiveMessage("Please fix the highlighted fields")
      }
    }, 300)

    return () => window.clearTimeout(handle)
  }, [customResponses, getAssignedAgentValidationError, getZodErrors, roleQuestions])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasUnsavedChanges) return

    const interval = window.setInterval(() => {
      try {
        const payload = {
          version: 1,
          savedAt: new Date().toISOString(),
          selectedDate,
          departmentId,
          currentStep,
          formData,
          customResponses,
        }
        window.localStorage.setItem(draftKeyForDate(selectedDate), JSON.stringify(payload))
        setDraftSavedAt(payload.savedAt)
        setHasUnsavedChanges(false)
      } catch {
        // ignore
      }
    }, 5000)

    return () => window.clearInterval(interval)
  }, [currentStep, customResponses, departmentId, draftKeyForDate, formData, hasUnsavedChanges, selectedDate])

  useEffect(() => {
    if (typeof window === "undefined" || !hasUnsavedChanges) return

    const message = "You have unsaved changes. Leave this page?"
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return

      const nextUrl = new URL(anchor.href, window.location.href)
      const currentUrl = new URL(window.location.href)
      if (
        nextUrl.origin === currentUrl.origin &&
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return
      }

      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  // Steps: Date -> each role question -> Preview
  const steps = useMemo(() => {
    const stepsList: { key: string; title: string }[] = [{ key: "date", title: "Select Date" }]

    // One step per role question, with a dedicated title (falls back to label)
    roleQuestions.forEach((question, index) => {
      const q = question as Record<string, unknown>
      const title = String(q.title || q.label || `Question ${index + 1}`)
      stepsList.push({
        key: `question-${q.key}`,
        title,
      })
    })

    stepsList.push({ key: "preview", title: "Preview & Submit" })

    return stepsList.map((step, index) => ({
      ...step,
      number: index + 1,
    }))
  }, [roleQuestions])

  useEffect(() => {
    if (currentStep > steps.length) {
      setCurrentStep(steps.length)
    }
  }, [steps, currentStep])

  const handleCustomResponseChange = useCallback((questionKey: string, value: unknown) => {
    markAsChanged()
    setCustomResponses((prev) => ({ ...prev, [questionKey]: value }))
    setCustomErrors((prev) => {
      if (!prev[questionKey]) {
        return prev
      }
      return { ...prev, [questionKey]: "" }
    })
  }, [markAsChanged])

  const validateCustomResponses = useCallback(() => {
    if (roleQuestions.length === 0) {
      return true
    }

    const zodErrors = getZodErrors(customResponses)
    const mergedErrors: Record<string, string> = { ...zodErrors }

    roleQuestions.forEach((question) => {
      const q = question as Record<string, unknown>
      if (mergedErrors[String(q.key)]) return
      const agentError = getAssignedAgentValidationError(q as FormQuestion, customResponses[String(q.key)])
      if (agentError) {
        mergedErrors[String(q.key)] = agentError
        return
      }
      try {
        const error = validateResponse(q as unknown as CustomQuestion, customResponses[String(q.key)])
        if (error) {
          mergedErrors[String(q.key)] = error
        }
      } catch {
        // ignore
      }
    })

    setCustomErrors(mergedErrors)
    return Object.keys(mergedErrors).length === 0
  }, [roleQuestions, customResponses, validateResponse, getZodErrors, getAssignedAgentValidationError])

  // Validate a specific step by its index (0-based in the steps array)
  const validateStepByIndex = useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex]
      if (!step) return true

      // Only role-question steps have per-step validation; other steps currently always pass
      if (!step.key.startsWith("question-")) {
        return true
      }

      const questionKey = step.key.replace("question-", "")
      const question = roleQuestions.find((q: Record<string, unknown>) => q.key === questionKey) as Record<
        string,
        unknown
      >

      if (!question) {
        return true
      }

      const assignedAgentError = getAssignedAgentValidationError(
        question as FormQuestion,
        customResponses[String(question.key)]
      )
      if (assignedAgentError) {
        setCustomErrors((prev) => ({ ...prev, [String(question.key)]: assignedAgentError }))
        setLiveMessage("Please fix the highlighted fields")
        return false
      }

      const zodErrors = getZodErrors(customResponses)
      const mergedErrors: Record<string, string> = { ...zodErrors }
      try {
        const error = validateResponse(question as unknown as CustomQuestion, customResponses[String(question.key)])
        if (error) {
          mergedErrors[String(question.key)] = error
        }
      } catch {
        // ignore
      }

      if (mergedErrors[String(question.key)]) {
        setCustomErrors((prev) => ({ ...prev, [String(question.key)]: mergedErrors[String(question.key)] }))
        setLiveMessage("Please fix the highlighted fields")
        return false
      }

      return true
    },
    [steps, roleQuestions, customResponses, validateResponse, getZodErrors, getAssignedAgentValidationError]
  )

  const handleNext = () => {
    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
    }

    // Step 1 (date selection): allow any past date through today.
    if (currentStepConfig?.key === "date") {
      const createValidation = canCreateEntryForDate(selectedDate)
      if (!createValidation.isValid) {
        const message = createValidation.error || "This date is not available for a new report"
        setDateError(message)
        toast.error(message)
        return
      }
    }

    if (currentStep < steps.length) {
      markAsChanged()
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      markAsChanged()
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle clicking directly on a step title in the progress header
  const handleStepClick = (targetStepNumber: number) => {
    if (targetStepNumber === currentStep) return

    // Always allow going backwards without validation
    if (targetStepNumber < currentStep) {
      markAsChanged()
      setCurrentStep(targetStepNumber)
      return
    }

    // Moving forward: validate only the current step before jumping ahead
    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
    }

    markAsChanged()
    setCurrentStep(targetStepNumber)
  }

  // Check if Next button should be disabled
  const isNextDisabled = useMemo(() => {
    const currentIndex = currentStep - 1
    const step = steps[currentIndex]
    if (!step) return false

    // For question steps, check if there are errors
    if (step.key.startsWith("question-")) {
      const questionKey = step.key.replace("question-", "")
      const question = roleQuestions.find((q: unknown) => {
        if (!q || typeof q !== "object") return false
        return (q as { key?: unknown }).key === questionKey
      }) as FormQuestion | undefined

      if (question?.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
        return isAssignedAgentsLoading || !!assignedAgentsError || noAvailableAssignedAgents
      }

      return customErrors[questionKey] !== undefined && customErrors[questionKey] !== ""
    }

    return false
  }, [assignedAgentsError, currentStep, customErrors, isAssignedAgentsLoading, noAvailableAssignedAgents, roleQuestions, steps])

  const formatQuestionResponseValue = useCallback(
    (question: FormQuestion, value: unknown) => {
      if (question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
        const parsed = parseAgentResponseValue(value)
        if (!parsed) {
          return "Not provided"
        }
        const agent = assignedAgents.find((item) => item.id === parsed.value)
        return agent?.name || parsed.label || parsed.value
      }

      if (Array.isArray(value)) {
        return value.length ? value.join(", ") : "Not provided"
      }

      if (value === "" || value === undefined || value === null) {
        return "Not provided"
      }

      return String(value)
    },
    [assignedAgents]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasVisibleQuestions) {
      setLiveMessage("No questions available for this report")
      return
    }
    if (hasStandardEntryConflict) {
      openExistingStandardReport()
      return
    }

    setIsSubmitting(true)

    try {
      // Validate custom responses before submission
      if (!validateCustomResponses()) {
        // Scroll to first error or show inline validation - no toast needed
        setIsSubmitting(false)
        return
      }

      let selectedAgentForEntry: AssignedAgentOption | null = null
      let responsesForProcessing = { ...customResponses }
      if (assignedAgentsQuestion) {
        const selectedAgentError = getAssignedAgentValidationError(
          assignedAgentsQuestion,
          customResponses[String(assignedAgentsQuestion.key)]
        )

        if (selectedAgentError) {
          setCustomErrors((prev) => ({ ...prev, [String(assignedAgentsQuestion.key)]: selectedAgentError }))
          setLiveMessage("Please fix the highlighted fields")
          setIsSubmitting(false)
          return
        }

        const selectedValue = parseAgentResponseValue(customResponses[String(assignedAgentsQuestion.key)])?.value ?? null
        selectedAgentForEntry = assignedAgents.find((agent) => agent.id === selectedValue) ?? null

        if (!selectedAgentForEntry) {
          setCustomErrors((prev) => ({
            ...prev,
            [String(assignedAgentsQuestion.key)]: "Select a valid assigned agent",
          }))
          setLiveMessage("Please fix the highlighted fields")
          setIsSubmitting(false)
          return
        }

        responsesForProcessing = {
          ...responsesForProcessing,
          [String(assignedAgentsQuestion.key)]: {
            value: selectedAgentForEntry.id,
            label: selectedAgentForEntry.name,
          },
        }
      }

      // Validate date before submission
      const dateValidation = canCreateEntryForDate(selectedDate)

      if (!dateValidation.isValid) {
        toast.error(dateValidation.error || "Invalid date selected")
        setIsSubmitting(false)
        return
      }

      // Process custom responses for storage
      const processedCustom = processResponses(
        roleQuestions.map((q) => q as unknown as CustomQuestion),
        responsesForProcessing
      )

      // Synchronize standard fields from customResponses back to formData
      // This ensures that SupabaseLogContext sees the data in the "standard" properties it expects
      const updatedFormData = { ...formData }
      Object.keys(customResponses).forEach((key) => {
        if (key in updatedFormData) {
          updatedFormData[key as keyof typeof formData] = String(customResponses[key] || "")
        }
      })

      // Add authentication check before any operation
      // Check both localStorage auth and Supabase auth
      const isUserAuthenticated = (isAuthenticated && user) || supabaseUser
      if (!isUserAuthenticated) {
        toast.error("Please sign in to submit logs.")
        setIsSubmitting(false)
        return
      }

      const submissionData = {
        date: selectedDate,
        ...updatedFormData,
        customResponses: processedCustom.processedResponses,
        entry_kind: selectedAgentForEntry ? ("agent_call" as const) : ("standard" as const),
        subject_agent_id: selectedAgentForEntry?.id || null,
        subject_agent_snapshot: selectedAgentForEntry
          ? {
              name: selectedAgentForEntry.name,
              location: selectedAgentForEntry.location,
              phone: selectedAgentForEntry.phone,
            }
          : null,
      }

      const now = new Date().toISOString()
      await addEntry({
        department_id: departmentId,
        ...submissionData,
        createdAt: now,
        updatedAt: now,
        metadata: null,
      })
      toast.success("Entry created successfully!")

      try {
        window.localStorage.removeItem(draftKeyForDate(selectedDate))
      } catch {
        // ignore
      }
      setDraftSavedAt(null)
      setWasDraftRestored(false)
      setHasUnsavedChanges(false)
      setLiveMessage("Log submitted")

      if (selectedAgentForEntry && stayOnAgentCallSave) {
        setFormData({ ...EMPTY_FORM_DATA })
        setCustomResponses(buildInitialCustomResponses())
        setCustomErrors({})
        setCurrentStep(roleQuestions.length > 0 ? 2 : 1)
        setAssignedAgentsSearch("")
        setAssignedAgentsReloadKey((prev) => prev + 1)
        setAgentCallSuccessMessage(
          `Saved the call report for ${selectedAgentForEntry.name}. You can now log the next assigned agent.`
        )
        onSave({ entryKind: "agent_call", date: selectedDate })
        return
      }

      onSave({
        entryKind: selectedAgentForEntry ? "agent_call" : "standard",
        date: selectedDate,
      })
    } catch (error) {
      console.error("Failed to save entry:", error)
      setLiveMessage("Failed to save entry")
      const maybeError = error as Record<string, unknown>
      if (maybeError && maybeError.name === "CaptainLogError") {
        if (maybeError.code === "AUTH_ERROR") {
          toast.error("Please sign in to submit logs.")
        } else if (maybeError.code === "PERMISSION_ERROR") {
          toast.error("You don't have permission to create or update entries.")
        } else if (typeof maybeError.message === "string") {
          toast.error(maybeError.message)
        } else {
          toast.error("Failed to save entry. Please try again.")
        }
      } else {
        toast.error("Failed to save entry. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const currentStepConfig = steps[currentStep - 1]

  const hasCustomErrors = useMemo(() => Object.values(customErrors).some(Boolean), [customErrors])

  const progressPercent = useMemo(() => {
    if (steps.length === 0) return 0
    return Math.round((currentStep / steps.length) * 100)
  }, [currentStep, steps.length])

  const quickDateOptions = useMemo(() => {
    const formatShort = (dateString: string) => {
      const d = new Date(dateString + "T00:00:00")
      return d.toLocaleDateString("default", { month: "short", day: "numeric" })
    }

    return quickPickDates.map((date, index) => ({
      key: `available-${index}`,
      label: formatShort(date),
      date,
    }))
  }, [quickPickDates])
  const getQuestionCategoryLabel = useCallback((category?: string, plural = false) => {
    if (category === "department_report") {
      return plural ? "Department Report Questions" : "Department Report"
    }
    return plural ? "Profession Questions" : "Profession Question"
  }, [])
  const getQuestionCategoryDescription = useCallback(
    (category?: string) => {
      if (category === "department_report") {
        return `These answers represent the ${normalizedDepartmentName} department.`
      }
      return `These answers apply to your assigned profession in ${normalizedDepartmentName}.`
    },
    [normalizedDepartmentName]
  )
  const submitButtonLabel = !hasVisibleQuestions
    ? "No Questions Available"
    : hasStandardEntryConflict
      ? "Open Existing Report"
    : noAvailableAssignedAgents
      ? assignedAgents.length === 0
        ? "No Assigned Agents Available"
        : "All Assigned Agents Reported"
      : isSubmitting
        ? "Saving..."
        : "Submit Log"

  const handleDiscardDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKeyForDate(selectedDate))
      } catch {
        // ignore
      }
    }

    setFormData({ ...EMPTY_FORM_DATA })
    setCustomResponses(buildInitialCustomResponses())
    setCustomErrors({})
    setCurrentStep(1)
    setDraftSavedAt(null)
    setWasDraftRestored(false)
    setHasUnsavedChanges(false)
    setAssignedAgentsSearch("")
    setAgentCallSuccessMessage(null)
    setLiveMessage("Draft discarded")
  }, [buildInitialCustomResponses, draftKeyForDate, selectedDate])

  const handleCancelClick = useCallback(() => {
    if (hasUnsavedChanges && typeof window !== "undefined") {
      const shouldLeave = window.confirm("You have unsaved changes. Leave this page?")
      if (!shouldLeave) {
        return
      }
    }

    onCancel(selectedDate)
  }, [hasUnsavedChanges, onCancel, selectedDate])

  const openExistingStandardReport = useCallback(() => {
    if (!existingStandardEntryHref || typeof window === "undefined") {
      return
    }

    window.location.assign(existingStandardEntryHref)
  }, [existingStandardEntryHref])

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col space-y-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-3xl font-bold">Daily Log Entry</h2>
          <p className="text-muted-foreground mt-2 text-sm">Reporting for {normalizedDepartmentName}</p>
          <p className="text-muted-foreground mt-1 text-base">{formatDate(selectedDate)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCancelClick} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {draftSavedLabel ? (
        <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{wasDraftRestored ? "Draft restored" : "Draft saved"}</p>
            <p className="text-muted-foreground text-xs">{draftSavedLabel}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDiscardDraft} className="gap-2">
            <X className="h-4 w-4" />
            Discard Draft
          </Button>
        </div>
      ) : null}

      {/* Step Content */}
      <Card className="flex flex-1 flex-col overflow-hidden shadow-sm">
        <CardHeader className="shrink-0 space-y-2">
          <div className="flex items-start justify-between gap-6">
            <CardDescription>
              Step {currentStep} of {steps.length}
            </CardDescription>
            <div className="flex flex-col items-end gap-2">
              <div className="text-muted-foreground text-sm">Progress ({progressPercent}%)</div>
              <Progress value={progressPercent} className="h-2 w-36" />
            </div>
          </div>
          {hasDepartmentReportQuestions ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Department report included
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                These answers represent the {normalizedDepartmentName} department.
              </p>
            </div>
          ) : null}
          {hasStandardEntryConflict ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                A standard report already exists for this date
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Open the existing report for {normalizedDepartmentName} on {formatDateHuman(selectedDate)} instead of
                creating another one.
              </p>
            </div>
          ) : null}
          {entryAvailabilityError && !hasAssignedAgentsQuestion ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {entryAvailabilityError}
              </p>
            </div>
          ) : null}
          {agentCallSuccessMessage ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Ready for the next call report</p>
              <p className="text-muted-foreground mt-2 text-sm">{agentCallSuccessMessage}</p>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="flex-1 space-y-6 overflow-y-auto">
          {/* Skeleton loading state while questions load */}
          {isRoleQuestionsLoading && currentStep > 1 && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          )}
          {/* Step 1: Select Date */}
          {currentStepConfig?.key === "date" && (
            <div className="space-y-4">
              {/* Date Restriction Info Banner */}
              <DateRestrictionBanner title={getDateRestrictionMessage()} />

              <div className="space-y-2">
                <label htmlFor="date" className="text-foreground text-lg font-semibold">
                  When is this log for?
                </label>
                <p className="text-muted-foreground text-sm">Select the date you are reporting for.</p>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className="border-input bg-background text-foreground focus:ring-primary w-full justify-between rounded-md border px-4 py-3 text-base focus:ring-2 focus:outline-none"
                      aria-label="Select report date"
                    >
                      <span className={selectedDateAsDate ? "" : "text-muted-foreground"}>
                        {selectedDateAsDate ? formatDateHuman(selectedDate) : "Select date"}
                      </span>
                      <CalendarDays className="text-muted-foreground h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="center"
                    sideOffset={8}
                    collisionPadding={8}
                    className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 min-h-[340px] w-full max-w-none p-3"
                    style={{ width: "100%" }}
                  >
                    <Calendar
                      mode="single"
                      selected={selectedDateAsDate}
                      onSelect={(date) => {
                        if (!date) return
                        handleDateSelection(formatLocalDate(date))
                        setIsDatePickerOpen(false)
                      }}
                      disabled={((date: Date) => !canCreateEntryForDate(formatLocalDate(date)).isValid) as Matcher}
                      initialFocus
                      className="w-full"
                      classNames={{
                        weekday:
                          "text-muted-foreground rounded-md flex-1 text-center text-[0.7rem] font-semibold tracking-wide select-none",
                        today: "ring-1 ring-primary/40 rounded-md bg-transparent text-foreground",
                        disabled: "text-muted-foreground opacity-50 pointer-events-none",
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <QuickDateChips
                  options={quickDateOptions}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelection}
                />
                {dateError && (
                  <div className="mt-2 rounded-md border border-red-500/50 bg-red-500/10 p-4">
                    <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {dateError}
                    </p>
                  </div>
                )}

                {isSelectedDateLockedForEdits ? (
                  <div className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
                    <p className="text-foreground flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4" />
                      Unavailable
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Future dates are unavailable. You can create a report for any past date through today.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Role-Based Questions - one question per step */}
          {currentStepConfig?.key.startsWith("question-") && (
            <div className="space-y-4">
              {(() => {
                const questionKey = currentStepConfig.key.replace("question-", "")
                const question = roleQuestions.find((q: unknown) => {
                  if (!q || typeof q !== "object") return false
                  const key = (q as { key?: unknown }).key
                  return typeof key === "string" && key === questionKey
                }) as FormQuestion | undefined
                if (!question) return null

                const valueForCount = customResponses[String(question.key)]
                const showCharacterCount =
                  (question.type === "text" || question.type === "textarea") && typeof valueForCount === "string"

                return (
                  <div className="space-y-4">
                    <div className="p-0">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                          <Badge variant={question.category === "department_report" ? "default" : "secondary"}>
                            {getQuestionCategoryLabel(question.category)}
                          </Badge>
                          <h3 className="text-sm font-medium">{question.label}</h3>
                          {question.required ? (
                            <span className="text-muted-foreground text-xs">Required field</span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-sm">{getQuestionCategoryDescription(question.category)}</p>
                        {question.description ? (
                          <p className="text-muted-foreground mt-2 text-sm">{question.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        {question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? (
                          <div className="space-y-4">
                            <div className="bg-muted/30 rounded-lg border p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Assigned agents</Badge>
                                <span className="text-sm font-medium">
                                  {reportedAssignedAgentsCount} of {assignedAgents.length} already reported today
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-2 text-sm">
                                Select one assigned agent to record this call report. Each agent can only have one call
                                report per date.
                              </p>
                            </div>

                            {isAssignedAgentsLoading ? (
                              <div className="flex items-center gap-2 rounded-lg border p-4 text-sm">
                                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                <span>Loading assigned agents...</span>
                              </div>
                            ) : assignedAgentsError ? (
                              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
                                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  {assignedAgentsError}
                                </p>
                              </div>
                            ) : noAvailableAssignedAgents ? (
                              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                  All assigned agents are already reported
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                  Every assigned agent already has a call report on {formatDateHuman(selectedDate)}.
                                  Change the date to keep reporting or wait until a new agent is assigned.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="space-y-3">
                                  <label htmlFor={`assigned-agent-search-${question.key}`} className="sr-only">
                                    Search assigned agents
                                  </label>
                                  <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                      id={`assigned-agent-search-${question.key}`}
                                      value={assignedAgentsSearch}
                                      onChange={(event) => {
                                        markAsChanged()
                                        setAssignedAgentsSearch(event.target.value)
                                      }}
                                      placeholder="Search assigned agents"
                                      className="pl-9"
                                    />
                                  </div>

                                  {noMatchingAssignedAgents ? (
                                    <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                      No assigned agents match your search.
                                    </div>
                                  ) : (
                                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
                                      {filteredAssignedAgents.map((agent) => {
                                        const isSelected = selectedAssignedAgentId === agent.id

                                        return (
                                          <button
                                            key={agent.id}
                                            type="button"
                                            onClick={() =>
                                              handleCustomResponseChange(String(question.key), {
                                                value: agent.id,
                                                label: agent.name,
                                              })
                                            }
                                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                              isSelected
                                                ? "border-primary bg-primary/5"
                                                : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                                            }`}
                                            aria-pressed={isSelected}
                                          >
                                            <div className="space-y-1">
                                              <p className="text-sm font-medium">{agent.name}</p>
                                              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                {agent.location ? <span>{agent.location}</span> : null}
                                                {agent.phone ? <span>{agent.phone}</span> : null}
                                              </div>
                                            </div>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {selectedAssignedAgent ? (
                                  <div className="bg-muted/20 rounded-lg border p-4">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">{selectedAssignedAgent.name}</p>
                                      <div className="text-muted-foreground space-y-2 text-sm">
                                        {selectedAssignedAgent.location ? (
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span>{selectedAssignedAgent.location}</span>
                                          </div>
                                        ) : null}
                                        {selectedAssignedAgent.phone ? (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 shrink-0" />
                                            <span>{selectedAssignedAgent.phone}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {customErrors[String(question.key)] ? (
                              <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                                {customErrors[String(question.key)]}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <RoleBasedQuestionFields
                            questions={[question]}
                            responses={customResponses}
                            errors={customErrors}
                            onChange={handleCustomResponseChange}
                            renderMode="fieldsOnly"
                          />
                        )}

                        {showCharacterCount ? (
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">{valueForCount.length} characters</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Preview */}
          {currentStepConfig?.key === "preview" && (
            <div className="space-y-6">
              <div className="bg-accent/10 border-accent/20 rounded-lg border p-4">
                <p className="text-accent flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Review your responses before submitting
                </p>
              </div>

              {hasVisibleQuestions ? (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-foreground flex items-center gap-2 text-xl font-semibold">
                    <ListChecks className="h-5 w-5" /> Report Responses
                  </h3>
                  <div className="space-y-6">
                    {[
                      {
                        key: "department",
                        title: getQuestionCategoryLabel("department_report", true),
                        description: `These answers represent the ${normalizedDepartmentName} department.`,
                        questions: departmentReportQuestions,
                      },
                      {
                        key: "profession",
                        title: getQuestionCategoryLabel("profession_question", true),
                        description: `These answers apply to your assigned profession in ${normalizedDepartmentName}.`,
                        questions: professionQuestions,
                      },
                    ]
                      .filter((group) => group.questions.length > 0)
                      .map((group) => (
                        <div key={group.key} className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={group.key === "department" ? "default" : "secondary"}>{group.title}</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">{group.description}</p>
                          </div>
                          <div className="space-y-4">
                            {group.questions.map((question, index) => {
                              const value = customResponses[String(question.key)]
                              const displayValue = formatQuestionResponseValue(question, value)

                              const questionStepIndex = steps.findIndex((step) => step.key === `question-${question.key}`)
                              const questionStepNumber = questionStepIndex >= 0 ? steps[questionStepIndex].number : null
                              const reactKey = getQuestionReactKey(question, index)
                              const previewAgent =
                                question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? selectedAssignedAgent : null

                              return (
                                <div
                                  key={reactKey}
                                  className="bg-muted/30 border-border/40 flex items-start justify-between gap-4 rounded-lg border p-4"
                                >
                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => questionStepNumber && handleStepClick(questionStepNumber)}
                                      className="text-foreground hover:text-primary cursor-pointer text-left text-sm font-medium transition-colors duration-150 ease-in-out disabled:cursor-default"
                                      disabled={!questionStepNumber}
                                    >
                                      {question.label}
                                    </button>
                                    <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{displayValue}</p>
                                    {previewAgent ? (
                                      <div className="text-muted-foreground mt-3 space-y-2 text-xs">
                                        {previewAgent.location ? (
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <span>{previewAgent.location}</span>
                                          </div>
                                        ) : null}
                                        {previewAgent.phone ? (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5 shrink-0" />
                                            <span>{previewAgent.phone}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                  {questionStepNumber && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-muted-foreground hover:text-primary hover:bg-muted h-8 w-8 cursor-pointer"
                                      onClick={() => handleStepClick(questionStepNumber)}
                                      aria-label="Edit response"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="mt-0 h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-foreground text-sm font-medium">No Report Questions Available</p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        No profession or department report questions are configured for {normalizedDepartmentName}.
                        Contact an administrator before submitting a log for this department.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex shrink-0 items-center justify-between">
        {currentStep === 1 ? (
          <Button variant="outline" className="invisible gap-2" type="button" tabIndex={-1} aria-hidden="true" disabled>
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
        ) : (
          <Button variant="outline" onClick={handlePrevious} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
        )}

        {currentStep < steps.length ? (
          hasStandardEntryConflict ? (
            existingStandardEntryHref && !isEntryAvailabilityLoading ? (
              <Button asChild className="gap-2">
                <Link href={existingStandardEntryHref}>
                  <Eye className="h-4 w-4" />
                  Open Existing Report
                </Link>
              </Button>
            ) : (
              <Button disabled className="gap-2">
                <Eye className="h-4 w-4" />
                Open Existing Report
              </Button>
            )
          ) : (
            <Button onClick={handleNext} disabled={isNextDisabled || isEntryAvailabilityLoading} className="gap-2">
              {currentStepConfig?.key === "date" ? "Continue" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )
        ) : (
          hasStandardEntryConflict ? (
            existingStandardEntryHref && !isEntryAvailabilityLoading ? (
              <Button asChild className="gap-2">
                <Link href={existingStandardEntryHref}>
                  <Eye className="h-4 w-4" />
                  Open Existing Report
                </Link>
              </Button>
            ) : (
              <Button disabled className="gap-2">
                <Eye className="h-4 w-4" />
                Open Existing Report
              </Button>
            )
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                hasCustomErrors ||
                !hasVisibleQuestions ||
                isAssignedAgentsLoading ||
                !!assignedAgentsError ||
                noAvailableAssignedAgents ||
                isEntryAvailabilityLoading
              }
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {submitButtonLabel}
            </Button>
          )
        )}
      </div>
    </div>
  )
}
