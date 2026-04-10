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
import { ImageResponsePreview } from "@/components/image-response-preview"
import { DateRestrictionBanner, QuickDateChips } from "@/components/features/daily-log/molecules"
import { EntryKindDropdown } from "@/components/entry-kind-dropdown"
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
  getAssignedAgentsDailyLimit,
  parseAgentResponseValue,
} from "@/lib/marketing-agents"

interface EntryFormMultistepProps {
  date?: string
  departmentId: string
  departmentName?: string
  allowedDates?: string[]
  initialExistingEntryId?: string | null
  onDateChange?: (date: string) => void
  onSave: (result?: { entryKind: string; date: string }) => void
  onCancel: (selectedDate?: string) => void
  stayOnAgentCallSave?: boolean
  role?: string | null
  initialRoleQuestions?: unknown[]
  initialQuestionsByKind?: Record<string, unknown[]>
  initialAvailableEntryKinds?: Array<{
    entry_kind: string
    label?: string
    is_default?: boolean
    allow_multiple_per_day?: boolean
  }>
}

type AssignedAgentUsageMap = Record<string, Record<string, number>>

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
  maxLogsPerAgentPerDay?: number | null
}

type StepKey = "date" | `question_${string}` | "preview"

interface Step {
  key: StepKey
  title: string
  number: number
}

interface LockedFlow {
  entryKind: string
  steps: Step[]
  questions: FormQuestion[]
}

interface Draft {
  version: number
  schemaVersion: number
  savedAt: string
  entryKind: string | null
  questionIds: string[]
  selectedDate: string
  departmentId: string
  currentStep: number
  formData: Record<string, string>
  customResponses: Record<string, unknown>
}

function getQuestionKeyFromStepKey(stepKey: string): string | null {
  if (stepKey.startsWith("question_")) {
    return stepKey.slice("question_".length)
  }

  if (stepKey.startsWith("question-")) {
    return stepKey.slice("question-".length)
  }

  return null
}

function findQuestionStepNumber(steps: Step[], questionKey: string): number | null {
  const questionStepIndex = steps.findIndex((step) => getQuestionKeyFromStepKey(step.key) === questionKey)
  return questionStepIndex >= 0 ? steps[questionStepIndex].number : null
}

function getLegacyQuestionKeyFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const legacyQuestionKey = (metadata as { legacy_question_key?: unknown }).legacy_question_key
  return typeof legacyQuestionKey === "string" && legacyQuestionKey.trim().length > 0 ? legacyQuestionKey : null
}

function normalizeInitialQuestion(question: unknown, index: number): FormQuestion | null {
  if (!question || typeof question !== "object") {
    return null
  }

  const candidate = question as Record<string, unknown>
  const metadata = candidate.metadata
  const id = typeof candidate.id === "string" ? candidate.id : undefined
  const keyCandidate =
    (typeof candidate.key === "string" && candidate.key) ||
    (typeof candidate.question_key === "string" && candidate.question_key) ||
    getLegacyQuestionKeyFromMetadata(metadata) ||
    id ||
    `question_${index + 1}`
  const labelCandidate =
    (typeof candidate.label === "string" && candidate.label) ||
    (typeof candidate.question_label === "string" && candidate.question_label) ||
    keyCandidate
  const titleCandidate =
    (typeof candidate.title === "string" && candidate.title) ||
    (typeof candidate.question_title === "string" && candidate.question_title) ||
    labelCandidate
  const typeCandidate =
    (typeof candidate.type === "string" && candidate.type) ||
    (typeof candidate.question_type === "string" && candidate.question_type) ||
    "text"

  return {
    id,
    key: keyCandidate,
    label: labelCandidate,
    title: titleCandidate,
    type: typeCandidate,
    description:
      (typeof candidate.description === "string" && candidate.description) ||
      (typeof candidate.question_description === "string" && candidate.question_description) ||
      undefined,
    placeholder: typeof candidate.placeholder === "string" ? candidate.placeholder : undefined,
    options: candidate.options,
    category: typeof candidate.category === "string" ? candidate.category : undefined,
    required:
      typeof candidate.required === "boolean"
        ? candidate.required
        : typeof candidate.is_required === "boolean"
          ? candidate.is_required
          : false,
    order:
      typeof candidate.order === "number"
        ? candidate.order
        : typeof candidate.display_order === "number"
          ? candidate.display_order
          : index,
    validationRules: candidate.validationRules ?? candidate.validation_rules,
    defaultValue: candidate.defaultValue,
    metadata,
    optionSourceKind:
      (typeof candidate.optionSourceKind === "string" && candidate.optionSourceKind) ||
      (typeof candidate.option_source_kind === "string" && candidate.option_source_kind) ||
      ((metadata as { option_source?: { kind?: unknown } } | null)?.option_source?.kind as string | undefined),
    maxLogsPerAgentPerDay: getAssignedAgentsDailyLimit(metadata),
  }
}

function parseAssignedAgentValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim()
        return parseAgentResponseValue(item)?.value ?? null
      })
      .filter((item): item is string => !!item)
  }

  const parsed = parseAgentResponseValue(value)
  return parsed?.value ? [parsed.value] : []
}

function getDefaultEntryKind(
  hasGroupedQuestions: boolean,
  questionsByKind: Record<string, FormQuestion[]>,
  availableEntryKinds: string[],
  configuredEntryKinds?: Array<{ entry_kind: string; is_default?: boolean }>
): string | null {
  if (!hasGroupedQuestions) {
    return "standard"
  }

  const configuredDefault = configuredEntryKinds?.find(
    (kind) => kind.is_default && availableEntryKinds.includes(kind.entry_kind)
  )?.entry_kind
  if (configuredDefault) {
    return configuredDefault
  }

  if (availableEntryKinds.length === 1) {
    return availableEntryKinds[0]
  }

  if ((questionsByKind.standard || []).length > 0) {
    return "standard"
  }

  return null
}

export function EntryFormMultistep({
  date: initialDate,
  departmentId,
  departmentName,
  allowedDates,
  initialExistingEntryId,
  onDateChange,
  onSave,
  onCancel,
  stayOnAgentCallSave = false,
  role,
  initialRoleQuestions,
  initialQuestionsByKind,
  initialAvailableEntryKinds,
}: EntryFormMultistepProps) {
  const { addEntry } = useCaptainLog()
  const { isAuthenticated, user } = useAuth()
  const { user: supabaseUser } = useSupabaseAuth() // Supabase authentication
  const { validateResponse, processResponses } = useRBAC()
  const normalizedQuestionsByKind = useMemo<Record<string, FormQuestion[]>>(() => {
    if (!initialQuestionsByKind) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(initialQuestionsByKind).map(([kind, questions]) => [
        kind,
        Array.isArray(questions)
          ? questions
              .map((question, index) => normalizeInitialQuestion(question, index))
              .filter((question): question is FormQuestion => question !== null)
              .sort((a, b) => a.order - b.order)
          : [],
      ])
    )
  }, [initialQuestionsByKind])
  const [questionsByKind] = useState<Record<string, FormQuestion[]>>(
    () => normalizedQuestionsByKind
  )
  const availableEntryKinds = useMemo(() => {
    return Object.keys(questionsByKind).filter((kind) => (questionsByKind[kind] || []).length > 0)
  }, [questionsByKind])
  const defaultEntryKind = useMemo(() => {
    return getDefaultEntryKind(!!initialQuestionsByKind, questionsByKind, availableEntryKinds, initialAvailableEntryKinds)
  }, [availableEntryKinds, initialAvailableEntryKinds, initialQuestionsByKind, questionsByKind])
  const [entryKind, setEntryKind] = useState<string | null>(() => defaultEntryKind)
  const requiresEntryKindSelection = initialQuestionsByKind && availableEntryKinds.length > 1
  const showEntryKindSelector = !!initialQuestionsByKind

  // Filter questions client-side based on selected entryKind (from grouped data)
  const filteredRoleQuestions = useMemo(() => {
    if (!entryKind) return []
    return questionsByKind[entryKind] || []
  }, [entryKind, questionsByKind])

  // Keep useRoleQuestions for fallback if no initialQuestionsByKind
  const { questions: fetchedQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(
    !initialQuestionsByKind ? (initialRoleQuestions as RoleQuestion[] | undefined) : undefined,
    departmentId,
    entryKind || undefined,
    role
  )

  // Use fetched questions if no initial data
  const effectiveRoleQuestions = initialQuestionsByKind ? filteredRoleQuestions : fetchedQuestions
  const effectiveIsLoading = initialQuestionsByKind ? false : isRoleQuestionsLoading
  const effectiveRoleQuestionsRef = useRef(effectiveRoleQuestions)
  const quickPickDates = useMemo(() => {
    if (Array.isArray(allowedDates) && allowedDates.length > 0) {
      return allowedDates
    }
    return getAllowedDates()
  }, [allowedDates])
  const effectiveRoleQuestionsSignature = useMemo(() => {
    return effectiveRoleQuestions
      .map((q) => {
        if (!q || typeof q !== "object") return ""
        const key = (q as { key?: unknown }).key
        const type = (q as { type?: unknown }).type
        const required = (q as { required?: unknown }).required
        const defaultValue = (q as { defaultValue?: unknown }).defaultValue
        return `${String(key ?? "")}:${String(type ?? "")}:${String(!!required)}:${String(defaultValue ?? "")}`
      })
      .join("|")
  }, [effectiveRoleQuestions])
  const normalizedDepartmentName = departmentName?.trim() || "Department"
  const hasVisibleQuestions = effectiveRoleQuestions.length > 0
  const assignedAgentQuestions = useMemo(
    () =>
      effectiveRoleQuestions.filter(
        (question) => (question as FormQuestion).optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
      ) as FormQuestion[],
    [effectiveRoleQuestions]
  )
  const assignedAgentsQuestion = assignedAgentQuestions[0]
  const primaryAssignedAgentQuestion = useMemo(
    () => assignedAgentQuestions.find((question) => question.type === "select"),
    [assignedAgentQuestions]
  )
  const hasAssignedAgentsQuestion = !!assignedAgentsQuestion
  const hasDepartmentReportQuestions = useMemo(
    () => effectiveRoleQuestions.some((question) => (question as FormQuestion).category === "department_report"),
    [effectiveRoleQuestions]
  )
  const departmentReportQuestions = useMemo(
    () =>
      effectiveRoleQuestions.filter(
        (question) => (question as FormQuestion).category === "department_report"
      ) as FormQuestion[],
    [effectiveRoleQuestions]
  )
  const professionQuestions = useMemo(
    () =>
      effectiveRoleQuestions.filter(
        (question) => (question as FormQuestion).category !== "department_report"
      ) as FormQuestion[],
    [effectiveRoleQuestions]
  )

  useEffect(() => {
    effectiveRoleQuestionsRef.current = effectiveRoleQuestions
  }, [effectiveRoleQuestions])

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lockedFlow, setLockedFlow] = useState<LockedFlow | null>(null)
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
  const [pendingUploadQuestions, setPendingUploadQuestions] = useState<Record<string, boolean>>({})
  const [dateError, setDateError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [assignedAgents, setAssignedAgents] = useState<AssignedAgentOption[]>([])
  const [assignedAgentUsageByQuestion, setAssignedAgentUsageByQuestion] = useState<AssignedAgentUsageMap>({})
  const [isAssignedAgentsLoading, setIsAssignedAgentsLoading] = useState(false)
  const [assignedAgentsError, setAssignedAgentsError] = useState<string | null>(null)
  const [assignedAgentsSearch, setAssignedAgentsSearch] = useState("")
  const [assignedAgentsReloadKey, setAssignedAgentsReloadKey] = useState(0)
  const [isEntryAvailabilityLoading, setIsEntryAvailabilityLoading] = useState(false)
  const [entryAvailabilityError, setEntryAvailabilityError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [wasDraftRestored, setWasDraftRestored] = useState(false)
  const [agentCallSuccessMessage, setAgentCallSuccessMessage] = useState<string | null>(null)
  const [existingEntryId, setExistingEntryId] = useState<string | null>(initialExistingEntryId ?? null)
  const [allowMultiplePerDay, setAllowMultiplePerDay] = useState(false)

  const handleEntryKindChange = useCallback((nextEntryKind: string | null) => {
    setEntryKind((currentEntryKind) => {
      const normalizedNextEntryKind = nextEntryKind || null
      if (currentEntryKind === normalizedNextEntryKind) {
        return currentEntryKind
      }

      setLockedFlow(null)
      setCurrentStep(1)
      setCustomErrors({})
      setAgentCallSuccessMessage(null)
      setHasUnsavedChanges(false)
      return normalizedNextEntryKind
    })
  }, [])

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

      // Check if there are any answers that would be lost
      const hasAnswers = Object.entries(customResponses).some(([key, value]) => {
        // Skip empty/default values
        if (value === "" || value === null || value === undefined) return false
        if (Array.isArray(value) && value.length === 0) return false
        if (typeof value === "boolean" && !value) return false
        return true
      })

      // Show confirmation if there are unsaved answers
      if (hasAnswers) {
        const confirmed = window.confirm("Changing the date will clear your current responses. Continue?")
        if (!confirmed) {
          return
        }
        // Clear the old draft when changing dates (fix draft key bug)
        try {
          window.localStorage.removeItem(draftKeyForDate(selectedDate))
        } catch {
          // ignore
        }
      }

      setSelectedDate(newDate)
      setAssignedAgentsSearch("")
      markAsChanged()
      onDateChange?.(newDate)

      const validation = canCreateEntryForDate(newDate)
      setDateError(validation.isValid ? null : validation.error || "Invalid date")
    },
    [markAsChanged, onDateChange, selectedDate, customResponses, draftKeyForDate]
  )

  const effectiveRoleQuestionsSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {}
    effectiveRoleQuestions.forEach((q) => {
      const question = q as unknown as {
        key?: unknown
        label?: unknown
        required?: unknown
        type?: unknown
        options?: unknown
      }
      const key = typeof question.key === "string" ? question.key : null
      const label = typeof question.label === "string" ? question.label : "Field"
      const required = !!question.required
      const type = typeof question.type === "string" ? question.type : "text"
      const hasCheckboxOptions = type === "checkbox" && Array.isArray(question.options) && question.options.length > 0

      if (!key) return

      if (!required) {
        shape[key] = z.unknown().optional()
        return
      }

      shape[key] = z.unknown().refine(
        (value) => {
          if (type === "checkbox") {
            return hasCheckboxOptions ? Array.isArray(value) && value.length > 0 : value === true
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
  }, [effectiveRoleQuestions])

  const getZodErrors = useCallback(
    (responses: Record<string, unknown>) => {
      const result = effectiveRoleQuestionsSchema.safeParse(responses)
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
    [effectiveRoleQuestionsSchema]
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
  const assignedAgentQuestionKey = primaryAssignedAgentQuestion?.key
  const selectedAssignedAgentResponse = assignedAgentQuestionKey
    ? customResponses[String(assignedAgentQuestionKey)]
    : undefined
  const selectedAssignedAgentIds = useMemo(() => {
    return parseAssignedAgentValues(selectedAssignedAgentResponse)
  }, [selectedAssignedAgentResponse])
  const selectedAssignedAgentId = useMemo(() => {
    return selectedAssignedAgentIds[0] ?? null
  }, [selectedAssignedAgentIds])
  const selectedAssignedAgent = useMemo(
    () => assignedAgents.find((agent) => agent.id === selectedAssignedAgentId) ?? null,
    [assignedAgents, selectedAssignedAgentId]
  )
  const getAssignedAgentUsageCount = useCallback(
    (questionKey: string, agentId: string) => assignedAgentUsageByQuestion[questionKey]?.[agentId] || 0,
    [assignedAgentUsageByQuestion]
  )
  const getQuestionAvailableAgents = useCallback(
    (question: FormQuestion | undefined, selectedIds: string[] = []) => {
      if (!question) return availableAssignedAgents
      const questionKey = String(question.key)
      const limit = typeof question.maxLogsPerAgentPerDay === "number" ? question.maxLogsPerAgentPerDay : null

      return availableAssignedAgents.filter((agent) => {
        if (selectedIds.includes(agent.id)) return true
        if (limit === null) return true
        return getAssignedAgentUsageCount(questionKey, agent.id) < limit
      })
    },
    [availableAssignedAgents, getAssignedAgentUsageCount]
  )
  const getAssignedAgentLimitReachedMessage = useCallback(
    (question: FormQuestion | undefined) => {
      if (!question) return "No assigned agents are available for this field."
      const limit = typeof question.maxLogsPerAgentPerDay === "number" ? question.maxLogsPerAgentPerDay : null
      if (limit === null) {
        return "No agents are assigned to you yet."
      }
      return `All assigned agents have reached this field's daily limit of ${limit}.`
    },
    []
  )
  const existingStandardEntryHref = existingEntryId ? `/reports/${existingEntryId}` : null
  const hasStandardEntryConflict = !allowMultiplePerDay && !!entryKind && !!existingEntryId

  useEffect(() => {
    setExistingEntryId((currentValue) => {
      const nextValue = initialExistingEntryId ?? null
      return currentValue === nextValue ? currentValue : nextValue
    })
  }, [initialExistingEntryId])

  useEffect(() => {
    if (!hasAssignedAgentsQuestion) {
      setAssignedAgents([])
      setAssignedAgentUsageByQuestion({})
      setAssignedAgentsError(null)
      setIsAssignedAgentsLoading(false)
      setAssignedAgentsSearch("")
      return
    }

    const dateValidation = canCreateEntryForDate(selectedDate)
    if (!dateValidation.isValid) {
      setAssignedAgents([])
      setAssignedAgentUsageByQuestion({})
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
          `/api/reporting/assigned-agents?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(selectedDate)}&entryKind=${encodeURIComponent(entryKind || "standard")}${assignedAgentQuestions.map((question) => `&questionKey=${encodeURIComponent(String(question.key))}`).join("")}`,
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
              : `Failed to load assigned agents (HTTP ${response.status})`
          )
        }

        const nextAgents = Array.isArray(payload?.data) ? (payload.data as AssignedAgentOption[]) : []
        setAssignedAgents(nextAgents)
        setAssignedAgentUsageByQuestion(
          payload?.usageByQuestion && typeof payload.usageByQuestion === "object"
            ? (payload.usageByQuestion as AssignedAgentUsageMap)
            : {}
        )
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        console.error("Failed to load assigned agents:", error)
        setAssignedAgents([])
        setAssignedAgentUsageByQuestion({})
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
  }, [assignedAgentQuestions, assignedAgentsReloadKey, departmentId, entryKind, hasAssignedAgentsQuestion, selectedDate])

  useEffect(() => {
    const dateValidation = canCreateEntryForDate(selectedDate)
    if (!dateValidation.isValid) {
      setExistingEntryId(null)
      setAllowMultiplePerDay(false)
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
          `/api/reporting/entry-availability?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(selectedDate)}&entryKind=${encodeURIComponent(entryKind || "standard")}${role ? `&role=${encodeURIComponent(role)}` : ""}`,
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

        setExistingEntryId(typeof payload?.data?.existingEntryId === "string" ? payload.data.existingEntryId : null)
        setAllowMultiplePerDay(payload?.data?.allowMultiplePerDay === true)
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        console.error("Failed to load entry availability:", error)
        setExistingEntryId(null)
        setAllowMultiplePerDay(false)
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
  }, [departmentId, entryKind, role, selectedDate])

  useEffect(() => {
    if (assignedAgentQuestions.length === 0 || isAssignedAgentsLoading || assignedAgentsError) {
      return
    }

    let didTrimSelection = false

    setCustomResponses((prev) => {
      let nextState = prev

      assignedAgentQuestions.forEach((question) => {
        const questionKey = String(question.key)
        const selectedValues = parseAssignedAgentValues(prev[questionKey])
        if (selectedValues.length === 0) {
          return
        }

        const availableAgentsForQuestion = getQuestionAvailableAgents(question, selectedValues)
        const nextValues = selectedValues.filter((value) => availableAgentsForQuestion.some((agent) => agent.id === value))
        if (nextValues.length === selectedValues.length) {
          return
        }

        didTrimSelection = true
        nextState = {
          ...nextState,
          [questionKey]: question.type === "multiselect" ? nextValues : nextValues[0] ? { value: nextValues[0] } : "",
        }
      })

      return nextState
    })

    if (didTrimSelection) {
      setCustomErrors((prev) => {
        const nextErrors = { ...prev }
        assignedAgentQuestions.forEach((question) => {
          nextErrors[String(question.key)] = ""
        })
        return nextErrors
      })
      setLiveMessage("Selected agent is no longer available for this date")
    }
  }, [
    assignedAgentQuestions,
    assignedAgentsError,
    getQuestionAvailableAgents,
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

      const availableAgentsForQuestion = getQuestionAvailableAgents(question)
      if (availableAgentsForQuestion.length === 0) {
        return getAssignedAgentLimitReachedMessage(question)
      }

      const selectedValues = parseAssignedAgentValues(value)
      if (selectedValues.length === 0) {
        return question.required ? `${question.label} is required` : null
      }

      const invalidSelection = selectedValues.find((selectedValue) => {
        return !assignedAgents.some((agent) => agent.id === selectedValue)
      })
      if (invalidSelection) {
        return "Select a valid assigned agent"
      }

      const limitReachedSelection = selectedValues.find((selectedValue) => {
        const limit = typeof question.maxLogsPerAgentPerDay === "number" ? question.maxLogsPerAgentPerDay : null
        if (limit === null) return false
        const usageCount = getAssignedAgentUsageCount(String(question.key), selectedValue)
        return usageCount >= limit
      })
      if (limitReachedSelection) {
        const limit = question.maxLogsPerAgentPerDay
        return `This agent has reached the daily limit${typeof limit === "number" ? ` of ${limit}` : ""} for this field.`
      }

      return null
    },
    [
      assignedAgents,
      assignedAgentsError,
      getAssignedAgentLimitReachedMessage,
      getAssignedAgentUsageCount,
      getQuestionAvailableAgents,
      isAssignedAgentsLoading,
    ]
  )

  const buildInitialCustomResponses = useCallback((existingResponses?: QuestionResponse[]) => {
    const responseMap: Record<string, unknown> = {}

    effectiveRoleQuestionsRef.current.forEach((question) => {
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

  // Validate draft before restore - check schemaVersion, entryKind, questionIds
  const validateDraft = useCallback(
    (draft: Draft | null, currentEntryKind: string | null): boolean => {
      if (!draft) return false

      // Check schema version
      if (draft.schemaVersion !== 1) {
        console.warn("Draft schema version mismatch, ignoring draft")
        return false
      }

      // Check entryKind matches
      if (draft.entryKind !== currentEntryKind) {
        console.warn(`Draft entryKind mismatch: ${draft.entryKind} vs ${currentEntryKind}, ignoring draft`)
        return false
      }

      // Check all questionIds exist in current questions
      const currentQuestionIds = new Set(
        effectiveRoleQuestions
          .map((q) => {
            const typedQ = q as { id?: string; key?: string }
            return typedQ.id || typedQ.key || ""
          })
          .filter(Boolean)
      )

      const missingQuestions = draft.questionIds.filter((id) => !currentQuestionIds.has(id))
      if (missingQuestions.length > 0) {
        console.warn(`Draft contains questions that no longer exist: ${missingQuestions.join(", ")}, ignoring draft`)
        return false
      }

      return true
    },
    [effectiveRoleQuestions]
  )

  // Initialize create-only form state for the selected date, optionally merged with a local draft.
  useEffect(() => {
    if (!entryKind && defaultEntryKind) {
      setEntryKind(defaultEntryKind)
    }
  }, [defaultEntryKind, entryKind])

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

    const typedDraft = draft as Draft | null

    // Validate draft before restoring
    const isDraftValid = validateDraft(typedDraft, entryKind)

    const hasDraft = isDraftValid && typedDraft !== null

    if (hasDraft && typeof typedDraft?.savedAt === "string") {
      setDraftSavedAt(typedDraft.savedAt)
    } else {
      setDraftSavedAt(null)
    }
    setWasDraftRestored(hasDraft)

    const baseFormData = {
      ...EMPTY_FORM_DATA,
    }
    const baseResponses = buildInitialCustomResponses()
    const maxStep = effectiveRoleQuestionsRef.current.length + 2
    const draftStep =
      hasDraft && typedDraft?.currentStep && typeof typedDraft.currentStep === "number" ? typedDraft.currentStep : 1
    setCurrentStep(draftStep)

    const mergedFormData =
      hasDraft && typedDraft?.formData && typeof typedDraft.formData === "object"
        ? { ...baseFormData, ...(typedDraft.formData as Record<string, unknown>) }
        : baseFormData
    const mergedResponses =
      hasDraft && typedDraft?.customResponses && typeof typedDraft.customResponses === "object"
        ? { ...baseResponses, ...(typedDraft.customResponses as Record<string, unknown>) }
        : baseResponses

    setFormData(mergedFormData as typeof formData)
    setCustomResponses(mergedResponses as Record<string, unknown>)
    setCurrentStep(draftStep)
    setCustomErrors({})
    setHasUnsavedChanges(false)
    setAgentCallSuccessMessage(null)
  }, [
    selectedDate,
    buildInitialCustomResponses,
    draftKeyForDate,
    effectiveRoleQuestionsSignature,
    entryKind,
    availableEntryKinds,
    validateDraft,
  ])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const errors = getZodErrors(customResponses)
      effectiveRoleQuestions.forEach((question) => {
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
  }, [customResponses, getAssignedAgentValidationError, getZodErrors, effectiveRoleQuestions])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasUnsavedChanges) return

    const interval = window.setInterval(() => {
      try {
        // Build questionIds from current questions (use activeQuestions if lockedFlow available)
        const currentQuestions = lockedFlow?.questions ?? effectiveRoleQuestions
        const questionIds = currentQuestions
          .map((q) => {
            const typedQ = q as { id?: string; key?: string }
            return typedQ.id || typedQ.key || ""
          })
          .filter(Boolean)

        const payload: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          entryKind: lockedFlow?.entryKind ?? entryKind,
          questionIds,
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
  }, [
    currentStep,
    customResponses,
    departmentId,
    draftKeyForDate,
    effectiveRoleQuestions,
    entryKind,
    formData,
    hasUnsavedChanges,
    lockedFlow,
    selectedDate,
  ])

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

  // Lock the flow when entryKind is first set and we have questions
  useEffect(() => {
    if (!entryKind || lockedFlow) return
    if (effectiveRoleQuestions.length === 0) return

    // Build locked steps with proper StepKey type
    const lockedSteps: Step[] = [{ key: "date", title: "Select Date", number: 1 }]

    effectiveRoleQuestions.forEach((question, index) => {
      const q = question as Record<string, unknown>
      const key = String(q.key || `q${index}`)
      const title = String(q.title || q.label || `Question ${index + 1}`)
      lockedSteps.push({
        key: `question_${key}` as StepKey,
        title,
        number: index + 2,
      })
    })

    lockedSteps.push({ key: "preview", title: "Preview & Submit", number: lockedSteps.length + 1 })

    setLockedFlow({
      entryKind,
      steps: lockedSteps,
      questions: effectiveRoleQuestions as FormQuestion[],
    })
  }, [entryKind, effectiveRoleQuestions, lockedFlow])

  // Derive flowEntryKind from lockedFlow for change detection (unused for now - future use for entryKind change warnings)
  const flowEntryKind = lockedFlow?.entryKind ?? null

  // Use lockedFlow questions when available, otherwise fall back to dynamic
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeQuestions = useMemo(
    () => lockedFlow?.questions ?? (effectiveRoleQuestions as FormQuestion[]),
    [lockedFlow?.questions, effectiveRoleQuestions]
  )

  // Steps: Date -> each role question -> Preview (use lockedFlow if available)
  const steps = useMemo(() => {
    if (lockedFlow?.steps) {
      return lockedFlow.steps
    }

    const stepsList: { key: string; title: string }[] = [{ key: "date", title: "Select Date" }]

    // One step per role question, with a dedicated title (falls back to label)
    effectiveRoleQuestions.forEach((question, index) => {
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
  }, [lockedFlow?.steps, effectiveRoleQuestions])

  useEffect(() => {
    if (currentStep > steps.length) {
      setCurrentStep(steps.length)
    }
  }, [steps, currentStep])

  const handleCustomResponseChange = useCallback(
    (questionKey: string, value: unknown) => {
      markAsChanged()
      setCustomResponses((prev) => ({ ...prev, [questionKey]: value }))
      setCustomErrors((prev) => {
        if (!prev[questionKey]) {
          return prev
        }
        return { ...prev, [questionKey]: "" }
      })
    },
    [markAsChanged]
  )

  const handleUploadPendingStateChange = useCallback((questionKey: string, hasBlockingUploads: boolean) => {
    setPendingUploadQuestions((prev) => {
      if (hasBlockingUploads) {
        if (prev[questionKey]) {
          return prev
        }

        return { ...prev, [questionKey]: true }
      }

      if (!prev[questionKey]) {
        return prev
      }

      const next = { ...prev }
      delete next[questionKey]
      return next
    })
  }, [])

  const validateCustomResponses = useCallback(() => {
    if (effectiveRoleQuestions.length === 0) {
      return true
    }

    const zodErrors = getZodErrors(customResponses)
    const mergedErrors: Record<string, string> = { ...zodErrors }

    effectiveRoleQuestions.forEach((question) => {
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
  }, [effectiveRoleQuestions, customResponses, validateResponse, getZodErrors, getAssignedAgentValidationError])

  // Validate a specific step by its index (0-based in the steps array)
  const validateStepByIndex = useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex]
      if (!step) return true

      // Only role-question steps have per-step validation; other steps currently always pass
      const questionKey = getQuestionKeyFromStepKey(step.key)
      if (!questionKey) {
        return true
      }
      const question = effectiveRoleQuestions.find((q: Record<string, unknown>) => q.key === questionKey) as Record<
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
    [steps, effectiveRoleQuestions, customResponses, validateResponse, getZodErrors, getAssignedAgentValidationError]
  )

  const handleNext = () => {
    if (isCurrentStepUploadBlocked) {
      setLiveMessage("Finish uploading all images before continuing.")
      return
    }

    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
    }

    // Step 1 (date selection): allow any past date through today.
    if (currentStepConfig?.key === "date") {
      if (requiresEntryKindSelection && !entryKind) {
        const message = "Select a report type to continue"
        setLiveMessage(message)
        toast.error(message)
        return
      }

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
    if (isCurrentStepUploadBlocked) {
      setLiveMessage("Finish uploading all images before continuing.")
      return
    }

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
    const questionKey = getQuestionKeyFromStepKey(step.key)
    if (questionKey) {
      const question = effectiveRoleQuestions.find((q: unknown) => {
        if (!q || typeof q !== "object") return false
        return (q as { key?: unknown }).key === questionKey
      }) as FormQuestion | undefined

      if (question?.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
        const selectedIds = parseAssignedAgentValues(customResponses[questionKey])
        const availableAgents = getQuestionAvailableAgents(question, selectedIds)
        return isAssignedAgentsLoading || !!assignedAgentsError || availableAgents.length === 0
      }

      return customErrors[questionKey] !== undefined && customErrors[questionKey] !== ""
    }

    return false
  }, [
    assignedAgentsError,
    currentStep,
    customResponses,
    customErrors,
    getQuestionAvailableAgents,
    isAssignedAgentsLoading,
    effectiveRoleQuestions,
    steps,
  ])

  const formatQuestionResponseValue = useCallback(
    (question: FormQuestion, value: unknown) => {
      if (question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
        const selectedIds = parseAssignedAgentValues(value)
        if (selectedIds.length === 0) {
          return "Not provided"
        }
        const selectedLabels = selectedIds.map((selectedId) => {
          const agent = assignedAgents.find((item) => item.id === selectedId)
          return agent?.name || selectedId
        })
        return selectedLabels.join(", ")
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

    // Double submit guard - early return if already submitting
    if (isSubmitting) {
      return
    }

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
      // Validate custom responses before submission (fresh validation)
      if (!validateCustomResponses()) {
        setIsSubmitting(false)
        return
      }

      let selectedAgentForEntry: AssignedAgentOption | null = null
      let responsesForProcessing = { ...customResponses }
      if (primaryAssignedAgentQuestion) {
        const selectedAgentError = getAssignedAgentValidationError(
          primaryAssignedAgentQuestion,
          customResponses[String(primaryAssignedAgentQuestion.key)]
        )

        if (selectedAgentError) {
          setCustomErrors((prev) => ({ ...prev, [String(primaryAssignedAgentQuestion.key)]: selectedAgentError }))
          setLiveMessage("Please fix the highlighted fields")
          setIsSubmitting(false)
          return
        }

        const selectedValue =
          parseAgentResponseValue(customResponses[String(primaryAssignedAgentQuestion.key)])?.value ?? null
        selectedAgentForEntry = assignedAgents.find((agent) => agent.id === selectedValue) ?? null

        if (!selectedAgentForEntry) {
          setCustomErrors((prev) => ({
            ...prev,
            [String(primaryAssignedAgentQuestion.key)]: "Select a valid assigned agent",
          }))
          setLiveMessage("Please fix the highlighted fields")
          setIsSubmitting(false)
          return
        }

        responsesForProcessing = {
          ...responsesForProcessing,
          [String(primaryAssignedAgentQuestion.key)]: {
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
        effectiveRoleQuestions.map((q) => q as unknown as CustomQuestion),
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

      const finalEntryKind = entryKind || "standard"
      const submissionData = {
        date: selectedDate,
        ...updatedFormData,
        customResponses: processedCustom.processedResponses,
        entry_kind: finalEntryKind,
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

      if (selectedAgentForEntry && finalEntryKind === "agent_call" && stayOnAgentCallSave) {
        setFormData({ ...EMPTY_FORM_DATA })
        setCustomResponses(buildInitialCustomResponses())
        setCustomErrors({})
        setCurrentStep(effectiveRoleQuestions.length > 0 ? 2 : 1)
        setAssignedAgentsSearch("")
        setAssignedAgentsReloadKey((prev) => prev + 1)
        setAgentCallSuccessMessage(
          `Saved the call report for ${selectedAgentForEntry.name}. You can now log the next assigned agent.`
        )
        onSave({ entryKind: "agent_call", date: selectedDate })
        return
      }

      onSave({
        entryKind: finalEntryKind,
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
  const currentQuestionKey = useMemo(() => getQuestionKeyFromStepKey(currentStepConfig?.key || ""), [currentStepConfig])
  const isCurrentStepUploadBlocked = useMemo(() => {
    if (!currentQuestionKey) {
      return false
    }

    return !!pendingUploadQuestions[currentQuestionKey]
  }, [currentQuestionKey, pendingUploadQuestions])
  const currentAssignedAgentQuestion = useMemo(() => {
    if (!currentQuestionKey) return null
    return assignedAgentQuestions.find((question) => String(question.key) === currentQuestionKey) || null
  }, [assignedAgentQuestions, currentStepConfig])
  const currentAssignedAgentSelectedIds = useMemo(() => {
    if (!currentAssignedAgentQuestion) return []
    return parseAssignedAgentValues(customResponses[String(currentAssignedAgentQuestion.key)])
  }, [currentAssignedAgentQuestion, customResponses])
  const availableAssignedAgentsForCurrentQuestion = useMemo(
    () => getQuestionAvailableAgents(currentAssignedAgentQuestion || undefined, currentAssignedAgentSelectedIds),
    [currentAssignedAgentQuestion, currentAssignedAgentSelectedIds, getQuestionAvailableAgents]
  )
  const noAvailableAssignedAgents =
    !!currentAssignedAgentQuestion &&
    !isAssignedAgentsLoading &&
    !assignedAgentsError &&
    availableAssignedAgentsForCurrentQuestion.length === 0
  const filteredAssignedAgents = useMemo(() => {
    const search = assignedAgentsSearch.trim().toLowerCase()
    if (!search) {
      return availableAssignedAgentsForCurrentQuestion
    }

    return availableAssignedAgentsForCurrentQuestion.filter((agent) =>
      [agent.name, agent.location, agent.phone]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(search))
    )
  }, [assignedAgentsSearch, availableAssignedAgentsForCurrentQuestion])
  const noMatchingAssignedAgents =
    !!currentAssignedAgentQuestion &&
    !isAssignedAgentsLoading &&
    !assignedAgentsError &&
    availableAssignedAgentsForCurrentQuestion.length > 0 &&
    filteredAssignedAgents.length === 0

  // Track if there are any custom errors (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          : "No Available Assigned Agents"
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
                <AlertCircle className="h-4 w-4 shrink-0" />A report for this type already exists on this date
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Open the existing report for {normalizedDepartmentName} on {formatDateHuman(selectedDate)} instead of
                creating another one.
              </p>
            </div>
          ) : null}
          {entryAvailabilityError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {entryAvailabilityError}
              </p>
            </div>
          ) : null}
          {agentCallSuccessMessage ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Ready for the next call report
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{agentCallSuccessMessage}</p>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="flex-1 space-y-6 overflow-y-auto">
          {/* Skeleton loading state while questions load */}
          {effectiveIsLoading && currentStep > 1 && (
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
                {showEntryKindSelector ? (
                  <EntryKindDropdown
                    departmentId={departmentId}
                    role={role}
                    value={entryKind}
                    onChange={handleEntryKindChange}
                    label="Report Type"
                  />
                ) : null}
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
          {getQuestionKeyFromStepKey(currentStepConfig?.key || "") && (
            <div className="space-y-4">
              {(() => {
                const questionKey = getQuestionKeyFromStepKey(currentStepConfig.key)
                if (!questionKey) return null
                const question = effectiveRoleQuestions.find((q: unknown) => {
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
                        <p className="text-muted-foreground text-sm">
                          {getQuestionCategoryDescription(question.category)}
                        </p>
                        {question.description ? (
                          <p className="text-muted-foreground mt-2 text-sm">{question.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        {question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? (
                          <div className="space-y-4">
                            {(() => {
                              const selectedIds = parseAssignedAgentValues(customResponses[String(question.key)])
                              const availableAgentsForQuestion = getQuestionAvailableAgents(question, selectedIds)
                              const selectedAgentForQuestion =
                                question.type !== "multiselect"
                                  ? assignedAgents.find((agent) => agent.id === selectedIds[0]) ?? null
                                  : null
                              const questionLimit =
                                typeof question.maxLogsPerAgentPerDay === "number" ? question.maxLogsPerAgentPerDay : null

                              return (
                                <>
                            <div className="bg-muted/30 rounded-lg border p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Assigned agents</Badge>
                                <span className="text-sm font-medium">
                                  {reportedAssignedAgentsCount} currently unavailable across this report type
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-2 text-sm">
                                {question.type === "multiselect"
                                  ? questionLimit === null
                                    ? "Select one or more assigned agents for this report."
                                    : `Select one or more assigned agents for this report. Each agent can be logged up to ${questionLimit} time${questionLimit === 1 ? "" : "s"} today for this field.`
                                  : questionLimit === null
                                    ? "Select one assigned agent for this report."
                                    : `Select one assigned agent for this report. Each agent can be logged up to ${questionLimit} time${questionLimit === 1 ? "" : "s"} today for this field.`}
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
                            ) : availableAgentsForQuestion.length === 0 ? (
                              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                  No assigned agents are currently available
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                  {getAssignedAgentLimitReachedMessage(question)} Change the date, wait for the limit to
                                  reset tomorrow, or choose a different field value if one is available.
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
                                        const selectedIds = parseAssignedAgentValues(customResponses[String(question.key)])
                                        const isSelected = selectedIds.includes(agent.id)

                                        return (
                                          <div
                                            key={agent.id}
                                            className={`rounded-lg border p-3 transition-colors ${
                                              isSelected
                                                ? "border-primary bg-primary/5"
                                                : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                                            }`}
                                          >
                                            {question.type === "multiselect" ? (
                                              <label
                                                htmlFor={`assigned-agent-${question.key}-${agent.id}`}
                                                className="flex cursor-pointer items-start gap-3"
                                              >
                                                <input
                                                  id={`assigned-agent-${question.key}-${agent.id}`}
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(event) => {
                                                    const nextValues = event.target.checked
                                                      ? [...selectedIds, agent.id]
                                                      : selectedIds.filter((item) => item !== agent.id)
                                                    handleCustomResponseChange(String(question.key), nextValues)
                                                  }}
                                                  className="mt-1 h-4 w-4"
                                                />
                                                <div className="space-y-1">
                                                  <p className="text-sm font-medium">{agent.name}</p>
                                                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                    {agent.location ? <span>{agent.location}</span> : null}
                                                    {agent.phone ? <span>{agent.phone}</span> : null}
                                                  </div>
                                                </div>
                                              </label>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCustomResponseChange(String(question.key), {
                                                    value: agent.id,
                                                    label: agent.name,
                                                  })
                                                }
                                                className="w-full text-left"
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
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {question.type !== "multiselect" && selectedAgentForQuestion ? (
                                  <div className="bg-muted/20 rounded-lg border p-4">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">{selectedAgentForQuestion.name}</p>
                                      <div className="text-muted-foreground space-y-2 text-sm">
                                        {selectedAgentForQuestion.location ? (
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span>{selectedAgentForQuestion.location}</span>
                                          </div>
                                        ) : null}
                                        {selectedAgentForQuestion.phone ? (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 shrink-0" />
                                            <span>{selectedAgentForQuestion.phone}</span>
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
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          <RoleBasedQuestionFields
                            questions={[question]}
                            responses={customResponses}
                            errors={customErrors}
                            onChange={handleCustomResponseChange}
                            onUploadPendingStateChange={handleUploadPendingStateChange}
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
                              <Badge variant={group.key === "department" ? "default" : "secondary"}>
                                {group.title}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">{group.description}</p>
                          </div>
                          <div className="space-y-4">
                            {group.questions.map((question, index) => {
                              const value = customResponses[String(question.key)]
                              const isImageQuestion = question.type === "image"
                              const displayValue = isImageQuestion ? null : formatQuestionResponseValue(question, value)

                              const questionStepNumber = findQuestionStepNumber(steps, String(question.key))
                              const reactKey = getQuestionReactKey(question, index)
                              const previewAgent =
                                question.optionSourceKind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND &&
                                question.type !== "multiselect"
                                  ? assignedAgents.find((agent) => {
                                      const selectedId = parseAssignedAgentValues(value)[0]
                                      return agent.id === selectedId
                                    }) || null
                                  : null

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
                                    <div className="mt-2">
                                      {isImageQuestion ? (
                                        <ImageResponsePreview value={value} className="max-w-3xl" />
                                      ) : (
                                        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{displayValue}</p>
                                      )}
                                    </div>
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
      <div className="shrink-0 space-y-2">
        {isCurrentStepUploadBlocked ? (
          <p className="text-destructive text-sm">Finish uploading all images before continuing.</p>
        ) : null}
        <div className="flex items-center justify-between">
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
              <Button
                onClick={handleNext}
                disabled={isNextDisabled || isCurrentStepUploadBlocked || isEntryAvailabilityLoading}
                className="gap-2"
              >
                {currentStepConfig?.key === "date" ? "Continue" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )
          ) : hasStandardEntryConflict ? (
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
              disabled={isSubmitting || !hasVisibleQuestions || noAvailableAssignedAgents}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {submitButtonLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
