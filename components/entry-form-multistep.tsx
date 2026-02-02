"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useAuth } from "@/contexts/auth-context"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { DateRestrictionBanner, QuickDateChips } from "@/components/features/daily-log/molecules"
import type { QuestionResponse } from "@/lib/rbac/types"
import { ArrowLeft, ArrowRight, Save, Eye, AlertCircle, ListChecks, Pencil, CalendarDays, Lock } from "lucide-react"
import { toast } from "sonner"
import {
  canCreateEntryForDate,
  canUpdateEntryForDate,
  formatLocalDate,
  formatDateHuman,
  getDateRestrictionMessage,
  getToday,
  getDaysAgo,
  getMaxAllowedDate,
  getMinAllowedDate,
} from "@/lib/date-restrictions"

interface EntryFormMultistepProps {
  date?: string
  departmentId: string
  onSave: () => void
  onCancel: () => void
  initialRoleQuestions?: any[]
}

export function EntryFormMultistep({
  date: initialDate,
  departmentId,
  onSave,
  onCancel,
  initialRoleQuestions,
}: EntryFormMultistepProps) {
  const { entries, addEntry, updateEntry } = useCaptainLog()
  const { isAuthenticated, user } = useAuth()
  const { user: supabaseUser } = useSupabaseAuth() // Supabase authentication
  const { validateResponse, processResponses } = useRBAC()
  const { questions: roleQuestions } = useRoleQuestions(initialRoleQuestions, departmentId)
  const roleQuestionsRef = useRef(roleQuestions)
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

  useEffect(() => {
    roleQuestionsRef.current = roleQuestions
  }, [roleQuestions])

  const entriesForDepartment = useMemo(
    () => entries.filter((e) => e.department_id === departmentId),
    [entries, departmentId]
  )
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getToday())
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const datePickerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [datePickerWidth, setDatePickerWidth] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    // Legacy fields (kept for backward compatibility with existing entries)
    objectives: "",
    keyResults: "",
    challenges: "",
    developmentTasks: "",
    featuresCompleted: "",
    challengesAndBlockers: "",
    codeAndPriorities: "",
    systemImprovements: "",
    projectUpdates: "",
  })
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const [dateError, setDateError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  const selectedDateAsDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00")
    return Number.isNaN(d.getTime()) ? undefined : d
  }, [selectedDate])

  const isSelectedDateLockedForEdits = useMemo(() => {
    return selectedDate < getMinAllowedDate()
  }, [selectedDate])

  const userIdForDraft = useMemo(() => {
    const anyUser = user as unknown as { id?: unknown; email?: unknown }
    const id = typeof anyUser?.id === "string" ? anyUser.id : null
    const email = typeof anyUser?.email === "string" ? anyUser.email : null
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
        shape[key] = z.any().optional()
        return
      }

      shape[key] = z.any().refine(
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

  useLayoutEffect(() => {
    const el = datePickerTriggerRef.current
    if (!el) return

    const updateWidth = () => {
      const next = Math.round(el.getBoundingClientRect().width)
      setDatePickerWidth((prev) => (prev === next ? prev : next))
    }

    updateWidth()
    const ro = new ResizeObserver(() => updateWidth())
    ro.observe(el)

    window.addEventListener("resize", updateWidth)
    return () => {
      window.removeEventListener("resize", updateWidth)
      ro.disconnect()
    }
  }, [])

  const buildInitialCustomResponses = useCallback((existingResponses?: QuestionResponse[]) => {
    const responseMap: Record<string, any> = {}

    roleQuestionsRef.current.forEach((question) => {
      const q = question as any
      const existing = existingResponses?.find(
        (response) => response.questionId === q.id || response.questionKey === q.key
      )

      if (existing) {
        responseMap[q.key] = existing.value
      } else if (q.defaultValue !== undefined) {
        responseMap[q.key] = q.defaultValue
      } else if (q.type === "multiselect") {
        responseMap[q.key] = []
      } else if (q.type === "checkbox") {
        responseMap[q.key] = false
      } else {
        responseMap[q.key] = ""
      }
    })

    return responseMap
  }, [])

  // Load existing entry if it exists, otherwise reset form
  useEffect(() => {
    const existingEntry = entriesForDepartment.find((entry) => entry.date === selectedDate)

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

    if (existingEntry) {
      const baseFormData = {
        objectives: (existingEntry as any).objectives || "",
        keyResults: (existingEntry as any).keyResults || "",
        challenges: (existingEntry as any).challenges || "",
        developmentTasks: existingEntry.developmentTasks || "",
        featuresCompleted: existingEntry.featuresCompleted || "",
        challengesAndBlockers: existingEntry.challengesAndBlockers || "",
        codeAndPriorities: existingEntry.codeAndPriorities || "",
        systemImprovements: existingEntry.systemImprovements || "",
        projectUpdates: existingEntry.projectUpdates || "",
      }
      // Fix the type issue by ensuring all required fields are present
      const fixedResponses = (existingEntry.customResponses || []).map((response) => ({
        questionId: response.questionId || "",
        questionKey: response.questionKey || "",
        questionLabel: response.questionLabel || "",
        questionType: response.questionType || "text",
        questionCategory: response.questionCategory || undefined,
        value: response.value,
        timestamp: response.timestamp || new Date().toISOString(),
      }))

      const baseResponses = buildInitialCustomResponses(fixedResponses)
      const mergedFormData =
        hasDraft && draftObj?.formData && typeof draftObj.formData === "object"
          ? { ...baseFormData, ...(draftObj.formData as Record<string, unknown>) }
          : baseFormData
      const mergedResponses =
        hasDraft && draftObj?.customResponses && typeof draftObj.customResponses === "object"
          ? { ...baseResponses, ...(draftObj.customResponses as Record<string, unknown>) }
          : baseResponses

      setFormData(mergedFormData as typeof formData)
      setCustomResponses(mergedResponses as Record<string, any>)
      if (hasDraft && typeof draftObj?.currentStep === "number") {
        setCurrentStep(draftObj.currentStep)
      }
    } else {
      const baseFormData = {
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
      const baseResponses = buildInitialCustomResponses()

      const mergedFormData =
        hasDraft && draftObj?.formData && typeof draftObj.formData === "object"
          ? { ...baseFormData, ...(draftObj.formData as Record<string, unknown>) }
          : baseFormData
      const mergedResponses =
        hasDraft && draftObj?.customResponses && typeof draftObj.customResponses === "object"
          ? { ...baseResponses, ...(draftObj.customResponses as Record<string, unknown>) }
          : baseResponses

      setFormData(mergedFormData as typeof formData)
      setCustomResponses(mergedResponses as Record<string, any>)
      if (hasDraft && typeof draftObj?.currentStep === "number") {
        setCurrentStep(draftObj.currentStep)
      }
    }
    // Always restart the wizard from the first step when the date changes
    if (!hasDraft) {
      setCurrentStep(1)
    }
    setCustomErrors({})
  }, [selectedDate, entriesForDepartment, buildInitialCustomResponses, draftKeyForDate, roleQuestionsSignature])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const errors = getZodErrors(customResponses)
      setCustomErrors(errors)

      if (Object.keys(errors).length > 0) {
        setLiveMessage("Please fix the highlighted fields")
      }
    }, 300)

    return () => window.clearTimeout(handle)
  }, [customResponses, getZodErrors])

  useEffect(() => {
    if (typeof window === "undefined") return

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
      } catch {
        // ignore
      }
    }, 5000)

    return () => window.clearInterval(interval)
  }, [currentStep, customResponses, departmentId, draftKeyForDate, formData, selectedDate])

  // Steps: Date -> each role question -> Preview
  const steps = useMemo(() => {
    const stepsList: { key: string; title: string }[] = [{ key: "date", title: "Select Date" }]

    // One step per role question, with a dedicated title (falls back to label)
    roleQuestions.forEach((question, index) => {
      const q: any = question
      const title = q.title || q.label || `Question ${index + 1}`
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

  const handleCustomResponseChange = useCallback((questionKey: string, value: any) => {
    setCustomResponses((prev) => ({ ...prev, [questionKey]: value }))
    setCustomErrors((prev) => {
      if (!prev[questionKey]) {
        return prev
      }
      return { ...prev, [questionKey]: "" }
    })
  }, [])

  const validateCustomResponses = useCallback(() => {
    if (roleQuestions.length === 0) {
      return true
    }

    const zodErrors = getZodErrors(customResponses)
    const mergedErrors: Record<string, string> = { ...zodErrors }

    roleQuestions.forEach((question) => {
      const q = question as any
      if (mergedErrors[q.key]) return
      try {
        const error = validateResponse(q, customResponses[q.key])
        if (error) {
          mergedErrors[q.key] = error
        }
      } catch {
        // ignore
      }
    })

    setCustomErrors(mergedErrors)
    return Object.keys(mergedErrors).length === 0
  }, [roleQuestions, customResponses, validateResponse, getZodErrors])

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
      const question = roleQuestions.find((q: any) => q.key === questionKey) as any

      if (!question) {
        return true
      }

      const zodErrors = getZodErrors(customResponses)
      const mergedErrors: Record<string, string> = { ...zodErrors }
      try {
        const error = validateResponse(question, customResponses[question.key])
        if (error) {
          mergedErrors[question.key] = error
        }
      } catch {
        // ignore
      }

      if (mergedErrors[question.key]) {
        setCustomErrors((prev) => ({ ...prev, [question.key]: mergedErrors[question.key] }))
        setLiveMessage("Please fix the highlighted fields")
        return false
      }

      return true
    },
    [steps, roleQuestions, customResponses, validateResponse, getZodErrors]
  )

  const handleNext = () => {
    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
    }

    // Step 1 (date selection): prevent creating new entries on locked dates.
    // Updates to existing entries are already gated by canUpdateEntryForDate in submit.
    if (currentStepConfig?.key === "date") {
      const existingEntry = entriesForDepartment.find((entry) => entry.date === selectedDate)
      if (!existingEntry) {
        const createValidation = canCreateEntryForDate(selectedDate)
        if (!createValidation.isValid) {
          setDateError(createValidation.error || "Invalid date")
          toast.error(createValidation.error || "This date is locked for new reports")
          return
        }
      }
    }

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle clicking directly on a step title in the progress header
  const handleStepClick = (targetStepNumber: number) => {
    if (targetStepNumber === currentStep) return

    // Always allow going backwards without validation
    if (targetStepNumber < currentStep) {
      setCurrentStep(targetStepNumber)
      return
    }

    // Moving forward: validate only the current step before jumping ahead
    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
    }

    setCurrentStep(targetStepNumber)
  }

  // Check if a step can be navigated to
  const canNavigateToStep = useCallback(
    (targetStepNumber: number) => {
      // Current step is always accessible
      if (targetStepNumber === currentStep) return true
      // Can always go backwards
      if (targetStepNumber < currentStep) return true
      // Can't jump forward from current step
      return false
    },
    [currentStep]
  )

  // Check if Next button should be disabled
  const isNextDisabled = useMemo(() => {
    const currentIndex = currentStep - 1
    const step = steps[currentIndex]
    if (!step) return false

    // For question steps, check if there are errors
    if (step.key.startsWith("question-")) {
      const questionKey = step.key.replace("question-", "")
      return customErrors[questionKey] !== undefined && customErrors[questionKey] !== ""
    }

    return false
  }, [currentStep, steps, customErrors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate custom responses before submission
      if (!validateCustomResponses()) {
        // Scroll to first error or show inline validation - no toast needed
        setIsSubmitting(false)
        return
      }

      // Check if we're updating an existing entry or creating a new one
      const existingEntry = entriesForDepartment.find((entry) => entry.date === selectedDate)

      // Validate date before submission
      const dateValidation = existingEntry
        ? canUpdateEntryForDate(selectedDate, existingEntry.createdAt)
        : canCreateEntryForDate(selectedDate)

      if (!dateValidation.isValid) {
        toast.error(dateValidation.error || "Invalid date selected")
        setIsSubmitting(false)
        return
      }

      // Process custom responses for storage
      const processedCustom = processResponses(
        roleQuestions.map((q) => q as any),
        customResponses
      )

      // Add authentication check before any operation
      // Check both localStorage auth and Supabase auth
      const isUserAuthenticated = (isAuthenticated && user) || supabaseUser
      if (!isUserAuthenticated) {
        toast.error("Please sign in to submit logs.")
        setIsSubmitting(false)
        return
      }

      if (existingEntry) {
        // Update existing entry
        await updateEntry(existingEntry.id, {
          date: selectedDate,
          ...formData,
          customResponses: processedCustom.processedResponses,
        })
        toast.success("Entry updated successfully!")
      } else {
        // Create new entry
        const now = new Date().toISOString()
        await addEntry({
          date: selectedDate,
          department_id: departmentId,
          ...formData,
          customResponses: processedCustom.processedResponses,
          createdAt: now,
          updatedAt: now,
          metadata: null,
        })
        toast.success("Entry created successfully!")
      }

      try {
        window.localStorage.removeItem(draftKeyForDate(selectedDate))
      } catch {
        // ignore
      }
      setDraftSavedAt(null)
      setLiveMessage("Log submitted")

      onSave()
    } catch (error) {
      console.error("Failed to save entry:", error)
      setLiveMessage("Failed to save entry")
      const maybeError = error as any
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

  // First role-question step number (1-based), or -1 if none
  const firstQuestionStepNumber = useMemo(() => {
    const index = steps.findIndex((step) => step.key.startsWith("question-"))
    return index >= 0 ? index + 1 : -1
  }, [steps])

  const hasCustomErrors = useMemo(() => Object.values(customErrors).some(Boolean), [customErrors])

  const progressPercent = useMemo(() => {
    if (steps.length === 0) return 0
    return Math.round((currentStep / steps.length) * 100)
  }, [currentStep, steps.length])

  const quickDateOptions = useMemo(() => {
    const today = getToday()
    const yesterday = getDaysAgo(1)
    const twoDaysAgo = getMinAllowedDate()

    const formatShort = (dateString: string) => {
      const d = new Date(dateString + "T00:00:00")
      return d.toLocaleDateString("default", { month: "short", day: "numeric" })
    }

    return [
      { key: "twoDaysAgo", label: formatShort(twoDaysAgo), date: twoDaysAgo },
      { key: "yesterday", label: "Yesterday", date: yesterday },
      { key: "today", label: "Today", date: today },
    ]
  }, [])

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col space-y-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-3xl font-bold">Daily Log Entry</h2>
          <p className="text-muted-foreground mt-2 text-base">{formatDate(selectedDate)}</p>
          {draftSavedLabel ? <p className="text-muted-foreground mt-2 text-xs">{draftSavedLabel}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Button>
      </div>

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
        </CardHeader>
        <CardContent className="flex-1 space-y-6 overflow-y-auto">
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
                      ref={datePickerTriggerRef}
                      variant="outline"
                      type="button"
                      className="border-input bg-background text-foreground focus:ring-primary w-full justify-between rounded-md border px-4 py-4 text-lg focus:ring-2 focus:outline-none"
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
                    align="start"
                    sideOffset={8}
                    collisionPadding={8}
                    className="max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
                    style={datePickerWidth ? { width: `${datePickerWidth}px` } : undefined}
                  >
                    <Calendar
                      mode="single"
                      selected={selectedDateAsDate}
                      className="w-full"
                      classNames={{
                        root: "w-full",
                        months: "w-full flex flex-col",
                        month: "w-full",
                        table: "w-full border-collapse",
                        weekdays: "grid grid-cols-7 w-full",
                        week: "grid grid-cols-7 w-full mt-2",
                        day: "relative w-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day select-none",
                        day_button: "aspect-auto h-8 sm:h-9 w-full min-w-0",
                      }}
                      onSelect={(date) => {
                        if (!date) return
                        const newDate = formatLocalDate(date)
                        setSelectedDate(newDate)
                        setIsDatePickerOpen(false)

                        const existingEntry = entries.find((entry) => entry.date === newDate)
                        const validation = existingEntry
                          ? canUpdateEntryForDate(newDate, existingEntry.createdAt)
                          : canCreateEntryForDate(newDate)
                        setDateError(validation.isValid ? null : validation.error || "Invalid date")
                      }}
                      disabled={{
                        before: new Date(getMinAllowedDate() + "T00:00:00"),
                        after: new Date(getMaxAllowedDate() + "T00:00:00"),
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <QuickDateChips
                  options={quickDateOptions}
                  selectedDate={selectedDate}
                  onSelectDate={(newDate) => {
                    setSelectedDate(newDate)

                    const existingEntry = entries.find((entry) => entry.date === newDate)
                    const validation = existingEntry
                      ? canUpdateEntryForDate(newDate, existingEntry.createdAt)
                      : canCreateEntryForDate(newDate)
                    setDateError(validation.isValid ? null : validation.error || "Invalid date")
                  }}
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
                      Locked
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      This date is older than 2 days. You cannot create a new report for it.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Check if entry exists for selected date */}
              {entries.find((entry) => entry.date === selectedDate) && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="mt-0 h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-foreground text-sm font-medium">Entry Already Exists</p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        An entry for this date already exists. Continuing will update the existing entry.
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
                })
                if (!question) return null

                const valueForCount = customResponses[question.key]
                const showCharacterCount =
                  (question.type === "text" || question.type === "textarea") && typeof valueForCount === "string"

                return (
                  <div className="space-y-4">
                    <div className="p-0">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                          <h3 className="text-sm font-medium">{question.label}</h3>
                          {question.required ? (
                            <span className="text-muted-foreground text-xs">Required field</span>
                          ) : null}
                        </div>
                        {question.description ? (
                          <p className="text-muted-foreground mt-2 text-sm">{question.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <RoleBasedQuestionFields
                          questions={[question]}
                          responses={customResponses}
                          errors={customErrors}
                          onChange={handleCustomResponseChange}
                          renderMode="fieldsOnly"
                        />

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
                  Review your role-specific responses before submitting
                </p>
              </div>

              {/* Only Role-Based Questions in Preview - Industrial Standard Approach */}
              {roleQuestions.length > 0 ? (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-foreground flex items-center gap-2 text-xl font-semibold">
                    <ListChecks className="h-5 w-5" /> Role-Specific Responses
                  </h3>
                  <div className="space-y-4">
                    {roleQuestions.map((question) => {
                      const value = customResponses[question.key]
                      const displayValue = Array.isArray(value)
                        ? value.length
                          ? value.join(", ")
                          : "Not provided"
                        : value === "" || value === undefined || value === null
                          ? "Not provided"
                          : String(value)

                      const questionStepIndex = steps.findIndex((step) => step.key === `question-${question.key}`)
                      const questionStepNumber = questionStepIndex >= 0 ? steps[questionStepIndex].number : null

                      return (
                        <div
                          key={question.key}
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
              ) : (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="mt-0 h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-foreground text-sm font-medium">No Role-Specific Questions</p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        Your role does not have any specific questions configured.
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
          <Button onClick={handleNext} disabled={isNextDisabled} className="gap-2">
            {currentStepConfig?.key === "date" ? "Continue" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting || hasCustomErrors} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Submit Log"}
          </Button>
        )}
      </div>
    </div>
  )
}
