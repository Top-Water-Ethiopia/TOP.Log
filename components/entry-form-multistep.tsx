"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { ArrowLeft, ArrowRight, Save, Eye, CheckCircle2, Target, CheckCircle, AlertTriangle, AlertCircle, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface EntryFormMultistepProps {
  date: string
  onSave: () => void
  onCancel: () => void
}

export function EntryFormMultistep({ date, onSave, onCancel }: EntryFormMultistepProps) {
  const { entries, addEntry, updateEntry } = useCaptainLog()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
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

  // Load existing entry if it exists
  useEffect(() => {
    const existingEntry = entries.find(entry => entry.date === date)
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
    }
  }, [date, entries])

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

  const handleNext = () => {
    if (currentStep < 4) {
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
      const existingEntry = entries.find(entry => entry.date === date)

      if (existingEntry) {
        // Update existing entry
        await updateEntry(existingEntry.id, {
          ...formData,
          date,
        })
        toast.success("Entry updated successfully!")
      } else {
        // Create new entry
        await addEntry({
          date,
          ...formData,
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

  const steps = [
    { number: 1, title: "Objectives", icon: Target },
    { number: 2, title: "Key Results", icon: CheckCircle },
    { number: 3, title: "Challenges", icon: AlertTriangle },
    { number: 4, title: "Preview & Submit", icon: Eye },
  ]

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Daily Log Entry</h2>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition-colors ${
                  currentStep === step.number
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.number
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.number ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <span className="text-xs mt-2 text-center hidden md:block">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-colors ${
                  currentStep > step.number ? "bg-green-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const StepIcon = steps[currentStep - 1].icon
              return <StepIcon className="h-6 w-6" />
            })()}
            {steps[currentStep - 1].title}
          </CardTitle>
          <CardDescription>
            Step {currentStep} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-6">
          {/* Step 1: Objectives */}
          {currentStep === 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What were your objectives today? <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground">What did you set out to accomplish?</p>
              <textarea
                value={formData.objectives}
                onChange={(e) => handleChange("objectives", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="Example:\n• Complete user authentication feature\n• Fix critical production bug\n• Review team pull requests\n• Improve database performance"
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

          {/* Step 2: Key Results */}
          {currentStep === 2 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What were your key results? <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground">Measurable outcomes and achievements</p>
              <textarea
                value={formData.keyResults}
                onChange={(e) => handleChange("keyResults", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="Example:\n• Deployed authentication to staging environment\n• Reduced response time from 500ms to 200ms\n• Approved 3 team PRs\n• Fixed 5 high-priority bugs\n• Completed 80% of sprint tasks"
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

          {/* Step 3: Challenges */}
          {currentStep === 3 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground text-lg">
                What challenges did you face?
              </label>
              <p className="text-sm text-muted-foreground">Obstacles, blockers, and difficulties encountered</p>
              <textarea
                value={formData.challenges}
                onChange={(e) => handleChange("challenges", e.target.value)}
                className="w-full min-h-[150px] max-h-[300px] p-4 rounded-md border border-input bg-background text-foreground resize-y text-base"
                placeholder="Example:\n• API rate limiting slowed integration testing\n• Missing documentation for legacy code\n• Dependency version conflicts\n• Waiting on security review\n• Test environment was down for 2 hours"
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

          {/* Step 4: Preview */}
          {currentStep === 4 && (
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

        {currentStep < 4 ? (
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
      {currentStep === 4 && (!formData.objectives || !formData.keyResults) && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 flex-shrink-0">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Required fields missing: {!formData.objectives && "Objectives"}{!formData.objectives && !formData.keyResults && ", "}{!formData.keyResults && "Key Results"}
          </p>
        </div>
      )}
    </div>
  )
}
