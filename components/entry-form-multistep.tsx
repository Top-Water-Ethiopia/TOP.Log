"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import type { QuestionResponse } from "@/lib/rbac/types"
import { ArrowLeft, ArrowRight, Save, Eye, CheckCircle2, Target, CheckCircle, AlertTriangle, AlertCircle, Sparkles, Calendar, ListChecks } from "lucide-react"
import { toast } from "sonner"

interface EntryFormMultistepProps {
  date?: string
  onSave: () => void
  onCancel: () => void
}

export function EntryFormMultistep({ date: initialDate, onSave, onCancel }: EntryFormMultistepProps) {
  const { entries, addEntry, updateEntry } = useCaptainLog()
  const { validateResponse, processResponses } = useRBAC()
  const { questions: roleQuestions } = useRoleQuestions()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || new Date().toISOString().split("T")[0])
  
  const [formData, setFormData] = useState({
    // Step 1: Objectives
    objectives: "",
    
    // Step 2: Key Results
    keyResults: "",
    
    // Step 3: Challenges
    challenges: "",
    
    // Legacy fields (for backward compatibility)
    developmentTasks: "",
    featuresCompleted: "",
    challengesAndBlockers: "",
    codeAndPriorities: "",
    systemImprovements: "",
    projectUpdates: "",
  })
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})

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
    const existingEntry = entries.find(entry => entry.date === selectedDate)

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
      setCustomResponses(buildInitialCustomResponses(existingEntry.customResponses))
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
      setCurrentStep(1)
    }

    setCustomErrors({})
  }, [selectedDate, entries, buildInitialCustomResponses])

  const steps = useMemo(() => {
    const baseSteps = [
      { key: "date", title: "Select Date", icon: Calendar },
      { key: "objectives", title: "Objectives", icon: Target },
      { key: "keyResults", title: "Key Results", icon: CheckCircle },
    ]

    if (roleQuestions.length > 0) {
      baseSteps.push({ key: "custom", title: "Role Questions", icon: ListChecks })
    }

    baseSteps.push({ key: "challenges", title: "Challenges", icon: AlertTriangle })
    baseSteps.push({ key: "preview", title: "Preview & Submit", icon: Eye })

    return baseSteps.map((step, index) => ({
      ...step,
      number: index + 1,
    }))
  }, [roleQuestions.length])

  useEffect(() => {
    if (currentStep > steps.length) {
      setCurrentStep(steps.length)
    }
  }, [steps, currentStep])

  // Character limits for form fields
  const CHARACTER_LIMITS = {
    objectives: 500,
    keyResults: 1000,
    challenges: 750,
  } as const

  

  const handleChange = (field: string, value: string) => {
    const limit = CHARACTER_LIMITS[field as keyof typeof CHARACTER_LIMITS]
    if (limit && value.length > limit) {
      return // Prevent input beyond limit
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

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

  const handleNext = () => {
    const currentStepData = steps[currentStep - 1]

    if (currentStepData?.key === "custom" && !validateCustomResponses()) {
      toast.error("Please resolve the highlighted role-specific questions before continuing.")
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

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const processedCustom = roleQuestions.length > 0
        ? processResponses(roleQuestions, customResponses)
        : { valid: true, errors: {}, processedResponses: [] }

      if (!processedCustom.valid) {
        setCustomErrors(processedCustom.errors)
        const customStepPosition = steps.findIndex((step) => step.key === "custom")
        if (customStepPosition >= 0) {
          setCurrentStep(customStepPosition + 1)
        }
        toast.error("Please resolve the role-specific questions before submitting.")
        setIsSubmitting(false)
        return
      }

      const existingEntry = entries.find(entry => entry.date === selectedDate)

      if (existingEntry) {
        // Update existing entry
        await updateEntry(existingEntry.id, {
          ...formData,
          date: selectedDate,
          customResponses: processedCustom.processedResponses,
        })
        toast.success("Entry updated successfully!")
      } else {
        // Create new entry
        await addEntry({
          date: selectedDate,
          ...formData,
          customResponses: processedCustom.processedResponses,
        })
        toast.success("Entry created successfully!")
      }

      onSave()
    } catch (error) {
      console.error("Failed to save entry:", error)
      toast.error("Failed to save entry. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const currentStepConfig = steps[currentStep - 1]

  const challengesStepNumber = useMemo(() => {
    const found = steps.find((step) => step.key === "challenges")
    return found ? found.number : -1
  }, [steps])

  const customStepNumber = useMemo(() => {
    const found = steps.find((step) => step.key === "custom")
    return found ? found.number : -1
  }, [steps])

  const hasCustomErrors = useMemo(() => Object.values(customErrors).some(Boolean), [customErrors])

  return (
    <div className="flex flex-col h-full space-y-4">
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

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition-colors ${
                  currentStep === step.number
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.number
                      ? "text-white"
                      : "bg-muted text-muted-foreground"
                }`}
                style={currentStep > step.number ? { backgroundColor: '#099748' } : undefined}
              >
                {currentStep > step.number ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <span className="text-xs mt-2 text-center hidden md:block">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-colors ${
                  currentStep > step.number ? "bg-muted" : "bg-muted"
                }`}
                style={currentStep > step.number ? { backgroundColor: '#099748' } : undefined}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            {currentStepConfig ? (
              <>
                <currentStepConfig.icon className="h-6 w-6" />
                {currentStepConfig.title}
              </>
            ) : null}
          </CardTitle>
          <CardDescription>
            Step {currentStep} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-6">
          {/* Step 1: Select Date */}
          {currentStepConfig?.key === "date" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium text-foreground text-lg">
                  Select Report Date <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">Choose the date for this daily log entry</p>
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 text-lg rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: <span className="font-medium">{formatDate(selectedDate)}</span>
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

          {/* Step 2: Objectives */}
          {currentStepConfig?.key === "objectives" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What were your objectives today? <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground">What did you set out to accomplish?</p>
              <textarea
                value={formData.objectives}
                onChange={(e) => handleChange("objectives", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="What were your objectives today?"
                required
                autoFocus
              />
              <div className="flex justify-end mt-2">
                <span className={`text-xs ${formData.objectives.length > CHARACTER_LIMITS.objectives * 0.9 ? 'text-destructive' : formData.objectives.length > CHARACTER_LIMITS.objectives * 0.8 ? 'text-orange-500' : 'text-muted-foreground'}
                `}>
                  {formData.objectives.length}/{CHARACTER_LIMITS.objectives}
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Key Results */}
          {currentStepConfig?.key === "keyResults" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What were your key results? <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground">Measurable outcomes and achievements</p>
              <textarea
                value={formData.keyResults}
                onChange={(e) => handleChange("keyResults", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="What were your key results?"
                required
                autoFocus
              />
              <div className="flex justify-end mt-2">
                <span className={`text-xs ${formData.keyResults.length > CHARACTER_LIMITS.keyResults * 0.9 ? 'text-destructive' : formData.keyResults.length > CHARACTER_LIMITS.keyResults * 0.8 ? 'text-orange-500' : 'text-muted-foreground'}
                `}>
                  {formData.keyResults.length}/{CHARACTER_LIMITS.keyResults}
                </span>
              </div>
            </div>
          )}

          {/* Role-Based Questions */}
          {currentStepConfig?.key === "custom" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground text-lg">
                  Role-Specific Questions
                </label>
                <p className="text-sm text-muted-foreground">
                  Answer the questions tailored to your role to capture relevant metrics.
                </p>
              </div>
              <RoleBasedQuestionFields
                questions={roleQuestions}
                responses={customResponses}
                errors={customErrors}
                onChange={handleCustomResponseChange}
              />
            </div>
          )}

          {/* Challenges */}
          {currentStepConfig?.key === "challenges" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What challenges did you face?
              </label>
              <p className="text-sm text-muted-foreground">Obstacles, blockers, and difficulties encountered</p>
              <textarea
                value={formData.challenges}
                onChange={(e) => handleChange("challenges", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="What challenges did you face?"
                autoFocus
              />
              <div className="flex justify-end mt-2">
                <span className={`text-xs ${formData.challenges.length > CHARACTER_LIMITS.challenges * 0.9 ? 'text-destructive' : formData.challenges.length > CHARACTER_LIMITS.challenges * 0.8 ? 'text-orange-500' : 'text-muted-foreground'}
                `}>
                  {formData.challenges.length}/{CHARACTER_LIMITS.challenges}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">Optional - Leave blank if no challenges today</p>
            </div>
          )}

          {/* Preview */}
          {currentStepConfig?.key === "preview" && (
            <div className="space-y-6">
              <div className="rounded-lg bg-accent/10 p-4 border border-accent/20">
                <p className="text-sm font-medium text-accent flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Review your log entry before submitting
                </p>
              </div>

              {/* 1. Objectives */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Target className="h-5 w-5" /> Objectives
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                    {formData.objectives || (
                      <span className="italic text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Required - Please go back and fill this in</span>
                    )}
                  </p>
                </div>
              </div>

              {/* 2. Key Results */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" /> Key Results
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                    {formData.keyResults || (
                      <span className="italic text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Required - Please go back and fill this in</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Role-Based Questions */}
              {roleQuestions.length > 0 && (
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
                      return (
                        <div key={question.id} className="bg-muted/30 p-4 rounded-lg border border-border/40">
                          <p className="text-sm font-medium text-foreground">{question.label}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                            {displayValue}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. Challenges */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Challenges
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                    {formData.challenges || (
                      <span className="italic text-muted-foreground flex items-center gap-2">No challenges reported today <Sparkles className="h-4 w-4" /></span>
                    )}
                  </p>
                </div>
              </div>
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
          <Button onClick={handleNext} className="gap-2">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.objectives || !formData.keyResults}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Submit Log"}
          </Button>
        )}
      </div>

      {/* Required Fields Notice */}
      {customStepNumber > -1 && currentStep === customStepNumber && hasCustomErrors && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 flex-shrink-0">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Please complete the required role-specific questions before continuing.
          </p>
        </div>
      )}

      {currentStep === challengesStepNumber && (!formData.objectives || !formData.keyResults) && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 flex-shrink-0">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Required fields missing: {!formData.objectives && "Objectives"}{!formData.objectives && !formData.keyResults && ", "}{!formData.keyResults && "Key Results"}
          </p>
        </div>
      )}
    </div>
  )
}
