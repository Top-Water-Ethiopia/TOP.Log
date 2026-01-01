"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useAuth } from "@/contexts/auth-context"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import type { QuestionResponse } from "@/lib/rbac/types"
import { ArrowLeft, ArrowRight, Save, Eye, AlertCircle, ListChecks, Pencil } from "lucide-react"
import { toast } from "sonner"
import { 
  getMinAllowedDate, 
  getMaxAllowedDate, 
  canCreateEntryForDate, 
  canUpdateEntryForDate,
  formatDateHuman,
  getDateRestrictionMessage
} from "@/lib/date-restrictions"

interface EntryFormMultistepProps {
  date?: string
  departmentId: string
  onSave: () => void
  onCancel: () => void
  initialRoleQuestions?: any[]
}

export function EntryFormMultistep({ date: initialDate, departmentId, onSave, onCancel, initialRoleQuestions }: EntryFormMultistepProps) {
  const { entries, addEntry, updateEntry } = useCaptainLog()
  const { isAuthenticated, user } = useAuth()
  const { user: supabaseUser } = useSupabaseAuth() // Supabase authentication
  const { validateResponse, processResponses } = useRBAC()
  const { questions: roleQuestions } = useRoleQuestions(initialRoleQuestions, departmentId)
  const entriesForDepartment = useMemo(() => entries.filter((e) => e.department_id === departmentId), [entries, departmentId])
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || new Date().toISOString().split("T")[0])
  
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

  const buildInitialCustomResponses = useCallback((existingResponses?: QuestionResponse[]) => {
    const responseMap: Record<string, any> = {}

    roleQuestions.forEach((question) => {
      const q = question as any
      const existing = existingResponses?.find((response) => response.questionKey === q.key)

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
  }, [roleQuestions])

  // Load existing entry if it exists, otherwise reset form
  useEffect(() => {
    const existingEntry = entriesForDepartment.find(entry => entry.date === selectedDate)

    if (existingEntry) {
      setFormData({
        objectives: (existingEntry as any).objectives || "",
        keyResults: (existingEntry as any).keyResults || "",
        challenges: (existingEntry as any).challenges || "",
        developmentTasks: existingEntry.developmentTasks || "",
        featuresCompleted: existingEntry.featuresCompleted || "",
        challengesAndBlockers: existingEntry.challengesAndBlockers || "",
        codeAndPriorities: existingEntry.codeAndPriorities || "",
        systemImprovements: existingEntry.systemImprovements || "",
        projectUpdates: existingEntry.projectUpdates || "",
      })
      // Fix the type issue by ensuring all required fields are present
      const fixedResponses = (existingEntry.customResponses || []).map(response => ({
        questionId: response.questionId || "",
        questionKey: response.questionKey || "",
        questionLabel: response.questionLabel || "",
        questionType: response.questionType || "text",
        questionCategory: response.questionCategory || undefined,
        value: response.value,
        timestamp: response.timestamp || new Date().toISOString(),
      }))
      setCustomResponses(buildInitialCustomResponses(fixedResponses))
    } else {
      setFormData({
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
      setCustomResponses(buildInitialCustomResponses())
    }
    // Always restart the wizard from the first step when the date changes
    setCurrentStep(1)
    setCustomErrors({})
  }, [selectedDate, entriesForDepartment])

  // Steps: Date -> each role question -> Preview
  const steps = useMemo(() => {
    const stepsList: { key: string; title: string }[] = [
      { key: "date", title: "Select Date" },
    ]

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

    const newErrors: Record<string, string> = {}

    roleQuestions.forEach((question) => {
      const q = question as any
      // Simple validation for required fields
      if (q.required && (!customResponses[q.key] || 
          (Array.isArray(customResponses[q.key]) && customResponses[q.key].length === 0))) {
        newErrors[q.key] = `${q.label} is required`
      } else {
        // Try to use validateResponse if available
        try {
          const error = validateResponse(q, customResponses[q.key])
          if (error) {
            newErrors[q.key] = error
          }
        } catch {
          // If validation fails, just check required
        }
      }
    })

    setCustomErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [roleQuestions, customResponses, validateResponse])

  // Validate a specific step by its index (0-based in the steps array)
  const validateStepByIndex = useCallback((stepIndex: number) => {
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

    const newErrors: Record<string, string> = {}
    const value = customResponses[question.key]

    if (question.required && (!value || (Array.isArray(value) && value.length === 0))) {
      newErrors[question.key] = `${question.label} is required`
    } else {
      try {
        const error = validateResponse(question, value)
        if (error) {
          newErrors[question.key] = error
        }
      } catch {
        // Fallback to simple required check only
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setCustomErrors((prev) => ({ ...prev, ...newErrors }))
      // Inline error will be displayed - no toast notification needed
      return false
    }

    return true
  }, [steps, roleQuestions, customResponses, validateResponse])

  const handleNext = () => {
    const currentIndex = currentStep - 1
    if (!validateStepByIndex(currentIndex)) {
      return
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
  const canNavigateToStep = useCallback((targetStepNumber: number) => {
    // Current step is always accessible
    if (targetStepNumber === currentStep) return true
    // Can always go backwards
    if (targetStepNumber < currentStep) return true
    // Can't jump forward from current step
    return false
  }, [currentStep])

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
      const existingEntry = entriesForDepartment.find(entry => entry.date === selectedDate)
      
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
        roleQuestions.map(q => q as any),
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

      onSave()
    } catch (error) {
      console.error("Failed to save entry:", error)
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

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Daily Log Entry</h2>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(selectedDate)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {/* Step Content */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm">
        <CardHeader className="flex-shrink-0">
          <CardDescription>
            Step {currentStep} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-6">
          {/* Step 1: Select Date */}
          {currentStepConfig?.key === "date" && (
            <div className="space-y-4">
              {/* Date Restriction Info Banner */}
              <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Date Restrictions</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getDateRestrictionMessage()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium text-foreground text-lg">
                  Select Report Date <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">Choose the date for this daily log entry</p>
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value
                    setSelectedDate(newDate)
                    
                    // Validate date and show error if invalid
                    const existingEntry = entries.find(entry => entry.date === newDate)
                    const validation = existingEntry 
                      ? canUpdateEntryForDate(newDate, existingEntry.createdAt)
                      : canCreateEntryForDate(newDate)
                    
                    setDateError(validation.isValid ? null : validation.error || "Invalid date")
                  }}
                  min={getMinAllowedDate()}
                  max={getMaxAllowedDate()}
                  className="w-full px-4 py-3 text-lg rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
                {dateError && (
                  <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 mt-2">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {dateError}
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: <span className="font-medium">{formatDateHuman(selectedDate)}</span>
                </p>
              </div>
              
              {/* Check if entry exists for selected date */}
              {entries.find(entry => entry.date === selectedDate) && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Entry Already Exists</p>
                      <p className="text-xs text-muted-foreground mt-1">
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
                const question = roleQuestions.find((q: any) => q.key === questionKey)
                if (!question) return null
                return (
                  <RoleBasedQuestionFields
                    questions={[question]}
                    responses={customResponses}
                    errors={customErrors}
                    onChange={handleCustomResponseChange}
                  />
                )
              })()}
            </div>
          )}

          {/* Preview */}
          {currentStepConfig?.key === "preview" && (
            <div className="space-y-6">
              <div className="rounded-lg bg-accent/10 p-4 border border-accent/20">
                <p className="text-sm font-medium text-accent flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Review your role-specific responses before submitting
                </p>
              </div>
              
              {/* Only Role-Based Questions in Preview - Industrial Standard Approach */}
              {roleQuestions.length > 0 ? (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <ListChecks className="h-5 w-5" /> Role-Specific Responses
                  </h3>
                  <div className="space-y-3">
                    {roleQuestions.map((question) => {
                      const value = customResponses[question.key]
                      const displayValue = Array.isArray(value)
                        ? (value.length ? value.join(", ") : "Not provided")
                        : value === "" || value === undefined || value === null
                          ? "Not provided"
                          : String(value)

                      const questionStepIndex = steps.findIndex((step) => step.key === `question-${question.key}`)
                      const questionStepNumber = questionStepIndex >= 0 ? steps[questionStepIndex].number : null

                      return (
                        <div
                          key={question.key}
                          className="bg-muted/30 p-4 rounded-lg border border-border/40 flex items-start justify-between gap-3"
                        >
                          <div>
                            <button
                              type="button"
                              onClick={() => questionStepNumber && handleStepClick(questionStepNumber)}
                              className="text-left text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer disabled:cursor-default"
                              disabled={!questionStepNumber}
                            >
                              {question.label}
                            </button>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                              {displayValue}
                            </p>
                          </div>
                          {questionStepNumber && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted cursor-pointer"
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
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No Role-Specific Questions</p>
                      <p className="text-xs text-muted-foreground mt-1">
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
      <div className="flex items-center justify-between flex-shrink-0">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          Step {currentStep} of {steps.length}
        </div>

        {currentStep < steps.length ? (
          <Button 
            onClick={handleNext} 
            disabled={isNextDisabled}
            className="gap-2"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || hasCustomErrors}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Submit Log"}
          </Button>
        )}
      </div>
    </div>
  )
}
