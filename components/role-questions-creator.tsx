"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  LayoutGrid,
  List,
  Shield,
  HelpCircle,
  Settings,
  Eye,
  Save,
  X
} from "lucide-react"
import { toast } from "sonner"

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
}

interface QuestionFormData {
  id: string // Temporary ID for tracking
  question_key: string
  question_label: string
  question_title: string
  question_type: string
  question_description: string
  placeholder: string
  options: string[] | null
  is_required: boolean
  display_order: number
  help_text: string
  default_value: string
  min_value: number | null
  max_value: number | null
  min_length: number | null
  max_length: number | null
  pattern: string
  step: number | null
  min_date: string
  max_date: string
  is_active: boolean
}

type CreationMode = "single" | "wizard"

type Step = "role" | "mode" | "questions" | "success"

export function RoleQuestionsCreator() {
  const router = useRouter()
  const { user } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState<Step>("role")
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [creationMode, setCreationMode] = useState<CreationMode>("single")
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdQuestions, setCreatedQuestions] = useState<any[]>([])
  const [roleQuestionCount, setRoleQuestionCount] = useState(0)

  // Load roles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setIsLoadingRoles(true)
        const response = await fetch("/api/admin/roles", {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
        
        if (!response.ok) throw new Error("Failed to load roles")
        
        const result = await response.json()
        const professionRoles = (result.data || []).filter((role: Role) => !!role.department_id)

        if (professionRoles.length === 0) {
          toast.info("No profession-specific roles found. Create one from the department admin page.")
        }

        setRoles(professionRoles)
      } catch (error: any) {
        console.error("Error loading roles:", error)
        toast.error("Failed to load roles: " + (error.message || "Unknown error"))
      } finally {
        setIsLoadingRoles(false)
      }
    }

    loadRoles()
  }, [])

  // Load existing question count for selected role
  useEffect(() => {
    if (!selectedRole) return

    const loadQuestionCount = async () => {
      try {
        const response = await fetch("/api/role-questions", {
          credentials: "include",
        })
        
        if (response.ok) {
          const allQuestions = await response.json()
          const count = allQuestions.filter((q: any) => q.role_id === selectedRole.id).length
          setRoleQuestionCount(count)
        }
      } catch (error) {
        console.error("Error loading question count:", error)
      }
    }

    loadQuestionCount()
  }, [selectedRole])

  // Initialize with one empty question
  useEffect(() => {
    if (currentStep === "questions" && questions.length === 0) {
      addQuestion()
    }
  }, [currentStep])

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      id: `temp-${Date.now()}-${Math.random()}`,
      question_key: "",
      question_label: "",
      question_title: "",
      question_type: "textarea",
      question_description: "",
      placeholder: "",
      options: null,
      is_required: false,
      display_order: questions.length,
      help_text: "",
      default_value: "",
      min_value: null,
      max_value: null,
      min_length: null,
      max_length: null,
      pattern: "",
      step: null,
      min_date: "",
      max_date: "",
      is_active: true,
    }
    setQuestions([...questions, newQuestion])
  }

  const removeQuestion = (id: string) => {
    const newQuestions = questions.filter((q) => q.id !== id)
    // Reorder display_order
    const reordered = newQuestions.map((q, index) => ({
      ...q,
      display_order: index,
    }))
    setQuestions(reordered)
    if (creationMode === "wizard" && currentQuestionIndex >= reordered.length) {
      setCurrentQuestionIndex(Math.max(0, reordered.length - 1))
    }
  }

  const updateQuestion = (id: string, updates: Partial<QuestionFormData>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)))
  }

  const handleRoleSelect = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (role) {
      setSelectedRole(role)
    }
  }

  const handleNext = () => {
    if (currentStep === "role") {
      if (!selectedRole) {
        toast.error("Please select a role")
        return
      }
      setCurrentStep("mode")
    } else if (currentStep === "mode") {
      setCurrentStep("questions")
    }
  }

  const handleBack = () => {
    if (currentStep === "mode") {
      setCurrentStep("role")
    } else if (currentStep === "questions") {
      setCurrentStep("mode")
    }
  }

  const validateQuestions = (): boolean => {
    if (questions.length === 0) {
      toast.error("Please add at least one question")
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      
      if (!q.question_key?.trim()) {
        toast.error(`Question ${i + 1}: Question key is required`)
        return false
      }
      
      if (!/^[a-z0-9_]+$/.test(q.question_key.trim())) {
        toast.error(`Question ${i + 1}: Question key must contain only lowercase letters, numbers, and underscores`)
        return false
      }
      
      if (!q.question_label?.trim()) {
        toast.error(`Question ${i + 1}: Question label is required`)
        return false
      }
      
      if (!q.question_type) {
        toast.error(`Question ${i + 1}: Question type is required`)
        return false
      }
      
      if ((q.question_type === "select" || 
           q.question_type === "multiselect" || 
           q.question_type === "radio" ||
           q.question_type === "rating") && 
          (!q.options || q.options.length === 0)) {
        toast.error(`Question ${i + 1}: Options are required for this question type`)
        return false
      }
    }

    // Check for duplicate question keys
    const keys = questions.map((q) => q.question_key.trim())
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
    if (duplicates.length > 0) {
      toast.error(`Duplicate question keys found: ${duplicates.join(", ")}`)
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateQuestions() || !selectedRole || !user) return

    try {
      setIsSubmitting(true)

      const questionsToSubmit = questions.map((q) => ({
        role_id: selectedRole.id,
        question_key: q.question_key.trim(),
        question_label: q.question_label.trim(),
        question_title: q.question_title.trim() || q.question_label.trim(),
        question_type: q.question_type,
        question_description: q.question_description?.trim() || null,
        placeholder: q.placeholder?.trim() || null,
        options: q.options && q.options.length > 0 ? q.options : null,
        is_required: q.is_required,
        display_order: q.display_order,
        validation_rules: null,
        is_active: q.is_active,
        help_text: q.help_text?.trim() || null,
        default_value: q.default_value?.trim() || null,
        min_value: q.min_value,
        max_value: q.max_value,
        min_length: q.min_length,
        max_length: q.max_length,
        pattern: q.pattern?.trim() || null,
        step: q.step,
        min_date: q.min_date || null,
        max_date: q.max_date || null,
        conditional_logic: null,
      }))

      const response = await fetch("/api/admin/role-questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questions: questionsToSubmit }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create questions")
      }

      setCreatedQuestions(result.data || [])
      setCurrentStep("success")
      toast.success(`Successfully created ${result.data?.length || 0} question(s)`)
    } catch (error: any) {
      console.error("Error creating questions:", error)
      toast.error(error.message || "Failed to create questions")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWizardNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handleWizardPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  // Render Role Selection Step
  if (currentStep === "role") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Select Role
          </CardTitle>
          <CardDescription>
            Choose the role for which you want to create questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingRoles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedRole?.id || ""}
                  onValueChange={handleRoleSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.name}</span>
                          {role.description && (
                            <span className="text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>
                        Selected: <strong>{selectedRole.name}</strong>
                      </span>
                      <Badge variant="secondary">
                        {roleQuestionCount} existing question{roleQuestionCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin/role-questions")}
                >
                  Cancel
                </Button>
                <Button onClick={handleNext} disabled={!selectedRole}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Render Mode Selection Step
  if (currentStep === "mode") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Choose Creation Mode</CardTitle>
          <CardDescription>
            Select how you want to create questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              className={`cursor-pointer transition-all ${
                creationMode === "single"
                  ? "ring-2 ring-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => setCreationMode("single")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Single Form
                </CardTitle>
                <CardDescription>
                  See all questions at once. Best for creating multiple questions quickly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${
                creationMode === "wizard"
                  ? "ring-2 ring-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => setCreationMode("wizard")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Wizard
                </CardTitle>
                <CardDescription>
                  Step through questions one at a time. Best for detailed question creation.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render Success Step
  if (currentStep === "success") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle>Questions Created Successfully!</CardTitle>
          </div>
          <CardDescription>
            {createdQuestions.length} question{createdQuestions.length !== 1 ? "s" : ""} created for {selectedRole?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Created Questions:</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {createdQuestions.map((q, index) => (
                <div key={q.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{q.question_label}</span>
                        <Badge variant="secondary">{q.question_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Key: <code className="text-xs">{q.question_key}</code>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                setQuestions([])
                setCurrentQuestionIndex(0)
                setCreatedQuestions([])
                setCurrentStep("questions")
                addQuestion()
              }}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create More Questions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRole(null)
                setQuestions([])
                setCurrentQuestionIndex(0)
                setCreatedQuestions([])
                setCurrentStep("role")
              }}
              className="flex-1"
            >
              Create for Another Role
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/admin/role-questions")}
              className="flex-1"
            >
              View All Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render Questions Step (both modes)
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create Questions for {selectedRole?.name}</CardTitle>
              <CardDescription>
                {creationMode === "single"
                  ? "Add and configure all questions below"
                  : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </Badge>
              {creationMode === "single" && (
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              )}
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || questions.length === 0}
                size={creationMode === "wizard" ? "default" : "sm"}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create {questions.length} Question{questions.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Questions Form */}
      {creationMode === "single" ? (
        <div className="space-y-6">
          {questions.map((question, index) => (
            <QuestionForm
              key={question.id}
              question={question}
              index={index}
              onUpdate={(updates) => updateQuestion(question.id, updates)}
              onRemove={() => removeQuestion(question.id)}
              canRemove={questions.length > 1}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {questions.length > 0 && (
            <>
              <QuestionForm
                question={questions[currentQuestionIndex]}
                index={currentQuestionIndex}
                onUpdate={(updates) =>
                  updateQuestion(questions[currentQuestionIndex].id, updates)
                }
                onRemove={() => removeQuestion(questions[currentQuestionIndex].id)}
                canRemove={questions.length > 1}
              />

              {/* Wizard Navigation */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={handleWizardPrevious}
                      disabled={currentQuestionIndex === 0}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addQuestion}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleWizardNext}
                      disabled={currentQuestionIndex === questions.length - 1}
                    >
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {creationMode === "single" && (
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/role-questions")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Question Form Component
interface QuestionFormProps {
  question: QuestionFormData
  index: number
  onUpdate: (updates: Partial<QuestionFormData>) => void
  onRemove: () => void
  canRemove: boolean
}

function QuestionForm({ question, index, onUpdate, onRemove, canRemove }: QuestionFormProps) {
  const [optionInput, setOptionInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    if (question.options) {
      setOptionInput(question.options.join(", "))
    }
  }, [question.options])

  const addOption = () => {
    if (!optionInput.trim()) return
    const newOptions = [...(question.options || []), optionInput.trim()]
    onUpdate({ options: newOptions })
    setOptionInput("")
  }

  const removeOption = (option: string) => {
    const newOptions = (question.options || []).filter((o) => o !== option)
    onUpdate({ options: newOptions.length > 0 ? newOptions : null })
  }

  const handleOptionInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addOption()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Question {index + 1}</Badge>
            <CardTitle className="text-lg">
              {question.question_title || question.question_label || "New Question"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={previewMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              title={previewMode ? "Exit Preview" : "Preview Mode"}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <X className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            {canRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {/* Preview Mode - Clean Final Output */}
      {previewMode && isExpanded ? (
        <CardContent className="pt-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Preview Mode</Badge>
                <span className="text-sm text-muted-foreground">
                  Final output - how users will see this question
                </span>
              </div>
            </div>
            <QuestionPreview question={question} isPreviewMode={true} />
          </div>
        </CardContent>
      ) : isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Question Key <span className="text-destructive">*</span>
              </Label>
              <Input
                value={question.question_key}
                onChange={(e) =>
                  onUpdate({ question_key: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                }
                placeholder="e.g., project_name"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (lowercase, numbers, underscores only)
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Question Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={question.question_type}
                onValueChange={(value) => onUpdate({ question_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Input</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="datetime">Date & Time</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="radio">Radio Buttons</SelectItem>
                  <SelectItem value="multiselect">Multi-Select</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="rating">Rating Scale</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Question Label <span className="text-destructive">*</span>
            </Label>
            <Input
              value={question.question_label}
              onChange={(e) => onUpdate({ question_label: e.target.value })}
              placeholder="What is your project name?"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Question Title
            </Label>
            <Input
              value={question.question_title}
              onChange={(e) => onUpdate({ question_title: e.target.value })}
              placeholder="Short title for wizard step (optional)"
            />
            <p className="text-xs text-muted-foreground">
              If provided, this title is used as the step name in the daily entry wizard. 
              Leave blank to use the question label.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={question.question_description}
              onChange={(e) => onUpdate({ question_description: e.target.value })}
              placeholder="Additional context for the question"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Placeholder</Label>
            <Input
              value={question.placeholder}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="Enter placeholder text"
            />
          </div>

          {/* Options for select/radio/rating/multiselect */}
          {(question.question_type === "select" ||
            question.question_type === "multiselect" ||
            question.question_type === "radio" ||
            question.question_type === "rating") && (
            <div className="space-y-2">
              <Label>
                Options <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={handleOptionInputKeyDown}
                  placeholder="Enter option and press Enter"
                />
                <Button type="button" onClick={addOption}>
                  Add
                </Button>
              </div>
              {question.options && question.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {question.options.map((option) => (
                    <Badge
                      key={option}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeOption(option)}
                    >
                      {option} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Advanced Configuration Tabs */}
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="validation">
                <Shield className="h-4 w-4 mr-1" />
                Validation
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings className="h-4 w-4 mr-1" />
                Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor={`help_text_${index}`} className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Help Text
                </Label>
                <Textarea
                  id={`help_text_${index}`}
                  value={question.help_text}
                  onChange={(e) => onUpdate({ help_text: e.target.value })}
                  placeholder="Additional help text or instructions"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input
                  value={question.default_value}
                  onChange={(e) => onUpdate({ default_value: e.target.value })}
                  placeholder="Default value for this question"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={question.is_required}
                  onCheckedChange={(checked) => onUpdate({ is_required: checked })}
                />
                <Label>Required Field</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={question.is_active}
                  onCheckedChange={(checked) => onUpdate({ is_active: checked })}
                />
                <Label>Active (visible to users)</Label>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4 mt-4">
              {/* Text validation */}
              {(question.question_type === "text" ||
                question.question_type === "textarea" ||
                question.question_type === "email" ||
                question.question_type === "url" ||
                question.question_type === "phone") && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Length</Label>
                      <Input
                        type="number"
                        min="0"
                        value={question.min_length || ""}
                        onChange={(e) =>
                          onUpdate({
                            min_length: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder="Min characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Length</Label>
                      <Input
                        type="number"
                        min="0"
                        value={question.max_length || ""}
                        onChange={(e) =>
                          onUpdate({
                            max_length: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder="Max characters"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Pattern (Regex)</Label>
                    <Input
                      value={question.pattern}
                      onChange={(e) => onUpdate({ pattern: e.target.value })}
                      placeholder="e.g., ^[A-Za-z]+$"
                    />
                  </div>
                </>
              )}

              {/* Number validation */}
              {question.question_type === "number" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Value</Label>
                    <Input
                      type="number"
                      value={question.min_value || ""}
                      onChange={(e) =>
                        onUpdate({
                          min_value: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="Min value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Value</Label>
                    <Input
                      type="number"
                      value={question.max_value || ""}
                      onChange={(e) =>
                        onUpdate({
                          max_value: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="Max value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Step</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={question.step || ""}
                      onChange={(e) =>
                        onUpdate({
                          step: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="e.g., 0.1 or 1"
                    />
                  </div>
                </div>
              )}

              {/* Date validation */}
              {(question.question_type === "date" ||
                question.question_type === "datetime") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Date</Label>
                    <Input
                      type="date"
                      value={question.min_date}
                      onChange={(e) => onUpdate({ min_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Date</Label>
                    <Input
                      type="date"
                      value={question.max_date}
                      onChange={(e) => onUpdate({ max_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Conditional logic and other advanced features will be available in a future update.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Live Preview Section */}
          <Separator className="my-6" />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <Label className="text-base font-semibold">Live Preview</Label>
              <Badge variant="outline" className="text-xs">
                How users will see this question
              </Badge>
            </div>
            <Card className="bg-muted/30 border-2 border-dashed">
              <CardContent className="pt-6">
                <QuestionPreview question={question} isPreviewMode={false} />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Question Preview Component - Mimics the real form experience
interface QuestionPreviewProps {
  question: QuestionFormData
  isPreviewMode?: boolean
}

function QuestionPreview({ question, isPreviewMode = false }: QuestionPreviewProps) {
  const [previewValue, setPreviewValue] = useState<string>(question.default_value || "")
  const [previewError, setPreviewError] = useState<string>("")
  const [touched, setTouched] = useState(false)

  // Initialize with default value and update when question changes
  useEffect(() => {
    if (question.default_value) {
      setPreviewValue(question.default_value)
    } else if (question.question_type === "multiselect") {
      setPreviewValue("[]")
    } else if (question.question_type === "checkbox") {
      setPreviewValue("false")
    } else {
      setPreviewValue("")
    }
    // Reset validation state when question changes
    setTouched(false)
    setPreviewError("")
  }, [question.default_value, question.question_type, question.question_key])

  // Validation function
  const validateValue = (value: string): string => {
    if (question.is_required && !value) {
      return "This field is required"
    }

    if (value) {
      // Text length validation
      if (question.min_length && value.length < question.min_length) {
        return `Minimum length is ${question.min_length} characters`
      }
      if (question.max_length && value.length > question.max_length) {
        return `Maximum length is ${question.max_length} characters`
      }

      // Pattern validation
      if (question.pattern) {
        try {
          const regex = new RegExp(question.pattern)
          if (!regex.test(value)) {
            return "Value does not match the required pattern"
          }
        } catch (e) {
          // Invalid regex pattern
        }
      }

      // Number validation
      if (question.question_type === "number") {
        const numValue = parseFloat(value)
        if (isNaN(numValue)) {
          return "Please enter a valid number"
        }
        if (question.min_value !== null && numValue < question.min_value) {
          return `Minimum value is ${question.min_value}`
        }
        if (question.max_value !== null && numValue > question.max_value) {
          return `Maximum value is ${question.max_value}`
        }
      }

      // Email validation
      if (question.question_type === "email" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return "Please enter a valid email address"
        }
      }

      // URL validation
      if (question.question_type === "url" && value) {
        try {
          new URL(value)
        } catch {
          return "Please enter a valid URL"
        }
      }
    }

    return ""
  }

  const handleChange = (newValue: string) => {
    setPreviewValue(newValue)
    if (touched) {
      setPreviewError(validateValue(newValue))
    }
  }

  const handleBlur = () => {
    setTouched(true)
    setPreviewError(validateValue(previewValue))
  }

  // Parse multiselect value
  const getMultiselectValue = (): string[] => {
    if (question.question_type === "multiselect") {
      try {
        return JSON.parse(previewValue || "[]")
      } catch {
        return []
      }
    }
    return []
  }

  return (
    <div className={`space-y-3 ${isPreviewMode ? "" : ""}`}>
      {/* Question Label with Required Indicator */}
      <Label 
        htmlFor={isPreviewMode ? `preview-${question.question_key || "question"}` : undefined}
        className={`${isPreviewMode ? "text-base" : "text-sm"} font-medium block`}
      >
        {question.question_label || "Question Label"}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Question Description */}
      {question.question_description && (
        <p className={`${isPreviewMode ? "text-sm" : "text-xs"} text-muted-foreground`}>
          {question.question_description}
        </p>
      )}

      {/* Question Input Based on Type */}
      {question.question_type === "text" && (
        <Input
          id={isPreviewMode ? `preview-${question.question_key || "question"}` : undefined}
          type="text"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || ""}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          pattern={question.pattern || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "textarea" && (
        <Textarea
          id={isPreviewMode ? `preview-${question.question_key || "question"}` : undefined}
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || ""}
          rows={4}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "email" && (
        <Input
          type="email"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || "example@email.com"}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          pattern={question.pattern || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "url" && (
        <Input
          type="url"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || "https://example.com"}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          pattern={question.pattern || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "phone" && (
        <Input
          type="tel"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || "+1 (555) 123-4567"}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          pattern={question.pattern || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "number" && (
        <Input
          type="number"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || ""}
          required={question.is_required}
          min={question.min_value !== null ? question.min_value : undefined}
          max={question.max_value !== null ? question.max_value : undefined}
          step={question.step || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "date" && (
        <Input
          type="date"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={question.is_required}
          min={question.min_date || undefined}
          max={question.max_date || undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "time" && (
        <Input
          type="time"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={question.is_required}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "datetime" && (
        <Input
          type="datetime-local"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={question.is_required}
          min={question.min_date ? `${question.min_date}T00:00` : undefined}
          max={question.max_date ? `${question.max_date}T23:59` : undefined}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {question.question_type === "select" && question.options && (
        <Select
          value={previewValue}
          onValueChange={handleChange}
          required={question.is_required}
        >
          <SelectTrigger className={previewError ? "border-destructive" : ""}>
            <SelectValue placeholder={question.placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {question.question_type === "radio" && question.options && (
        <RadioGroup
          value={previewValue}
          onValueChange={handleChange}
          required={question.is_required}
        >
          {question.options.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <RadioGroupItem value={option} id={`preview-radio-${option}`} />
              <Label htmlFor={`preview-radio-${option}`} className="cursor-pointer font-normal">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.question_type === "multiselect" && question.options && (
        <div className="space-y-3">
          {question.options.map((option) => {
            const selectedValues = getMultiselectValue()
            const isChecked = selectedValues.includes(option)
            
            return (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`preview-multiselect-${option}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const current = getMultiselectValue()
                    const newValues = checked
                      ? [...current, option]
                      : current.filter((v) => v !== option)
                    handleChange(JSON.stringify(newValues))
                  }}
                />
                <Label htmlFor={`preview-multiselect-${option}`} className="cursor-pointer font-normal">
                  {option}
                </Label>
              </div>
            )
          })}
        </div>
      )}

      {question.question_type === "checkbox" && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="preview-checkbox"
            checked={previewValue === "true"}
            onCheckedChange={(checked) => handleChange(checked ? "true" : "false")}
          />
          <Label htmlFor="preview-checkbox" className="cursor-pointer font-normal">
            {question.placeholder || "Yes"}
          </Label>
        </div>
      )}

      {question.question_type === "rating" && question.options && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => (
            <Button
              key={option}
              type="button"
              variant={previewValue === option ? "default" : "outline"}
              onClick={() => handleChange(option)}
              className="min-w-[60px]"
            >
              {option}
            </Button>
          ))}
        </div>
      )}

      {question.question_type === "file" && (
        <Input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              handleChange(file.name)
            }
          }}
          required={question.is_required}
          className={previewError ? "border-destructive" : ""}
        />
      )}

      {/* Help Text */}
      {question.help_text && (
        <p className={`${isPreviewMode ? "text-sm" : "text-xs"} text-muted-foreground`}>
          {question.help_text}
        </p>
      )}

      {/* Validation Error Message - Only show in preview mode when there's an error */}
      {isPreviewMode && touched && previewError && (
        <p className="text-sm text-destructive flex items-center gap-1 mt-2">
          <AlertCircle className="h-4 w-4" />
          {previewError}
        </p>
      )}

      {/* Validation Success Indicator - Only in edit mode, not in clean preview */}
      {!isPreviewMode && touched && !previewError && previewValue && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" />
          Valid
        </p>
      )}
    </div>
  )
}

