"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Shield, Eye, EyeOff, Save, X, Users } from "lucide-react"
import { toast } from "sonner"

type ApiRoleQuestion = {
  id?: unknown
  role_id?: unknown
  department_id?: unknown
  question_key?: unknown
  question_label?: unknown
  question_type?: unknown
  question_description?: unknown
  placeholder?: unknown
  options?: unknown
  is_required?: unknown
  display_order?: unknown
  min_value?: unknown
  max_value?: unknown
  min_length?: unknown
  max_length?: unknown
  pattern?: unknown
  step?: unknown
  min_date?: unknown
  max_date?: unknown
  is_active?: unknown
}

type SavedQuestion = {
  id: string
  question_label?: string | null
  question_type?: string | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function toQuestionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

function createEmptyQuestion(displayOrder = 0): QuestionFormData {
  return {
    id: `temp-${Date.now()}-${Math.random()}`,
    question_label: "",
    question_type: "textarea",
    question_description: "",
    placeholder: "",
    options: null,
    is_required: false,
    display_order: displayOrder,
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
}

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
}

interface Department {
  id: string
  name: string
  description: string | null
}

interface QuestionFormData {
  id: string // Temporary ID for tracking
  question_label: string
  question_type: string
  question_description: string
  placeholder: string
  options: string[] | null
  is_required: boolean
  display_order: number
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

type Step = "role" | "questions" | "success"
type QuestionScope = "role" | "department"

export function RoleQuestionsCreator() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSupabaseAuth()
  const didApplyUrlDefaultsRef = useRef(false)
  const [currentStep, setCurrentStep] = useState<Step>("questions")
  const [questionScope, setQuestionScope] = useState<QuestionScope>("role")
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const selectedRoleId = selectedRole?.id
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const selectedDepartmentId = selectedDepartment?.id
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [isLoadingExistingQuestions, setIsLoadingExistingQuestions] = useState(false)
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdQuestions, setCreatedQuestions] = useState<SavedQuestion[]>([])
  const [roleQuestionCount, setRoleQuestionCount] = useState(0)
  const [existingRoleQuestionKeys, setExistingRoleQuestionKeys] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    const canSubmit = questions.length > 0
    window.dispatchEvent(new CustomEvent("role-questions:can-submit", { detail: { canSubmit } }))
  }, [questions.length])

  useEffect(() => {
    if (didApplyUrlDefaultsRef.current) return

    const scopeParam = searchParams?.get("scope")
    const departmentIdParam = searchParams?.get("departmentId")
    const roleIdParam = searchParams?.get("roleId")

    if (!scopeParam) return

    if (scopeParam === "department") {
      if (isLoadingDepartments) return
      setQuestionScope("department")
      setSelectedRole(null)
      if (departmentIdParam) {
        const dept = departments.find((d) => d.id === departmentIdParam) || null
        setSelectedDepartment(dept)
      }
      didApplyUrlDefaultsRef.current = true
      return
    }

    if (scopeParam === "role") {
      if (isLoadingRoles) return
      setQuestionScope("role")
      setSelectedDepartment(null)
      if (roleIdParam) {
        const role = roles.find((r) => r.id === roleIdParam) || null
        setSelectedRole(role)
      }
      didApplyUrlDefaultsRef.current = true
    }
  }, [searchParams, departments, roles, isLoadingDepartments, isLoadingRoles])

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setIsLoadingDepartments(true)
        const response = await fetch("/api/admin/departments", {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error("Failed to load departments")

        const result = await response.json()
        const data = Array.isArray(result?.data) ? (result.data as Department[]) : []
        setDepartments(data)
      } catch (error: unknown) {
        console.error("Error loading departments:", error)
        toast.error("Failed to load departments")
      } finally {
        setIsLoadingDepartments(false)
      }
    }

    loadDepartments()
  }, [])

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
      } catch (error: unknown) {
        console.error("Error loading roles:", error)
        toast.error("Failed to load roles")
      } finally {
        setIsLoadingRoles(false)
      }
    }

    loadRoles()
  }, [])

  // Load existing question count for selected scope
  useEffect(() => {
    const activeScopeId = questionScope === "role" ? selectedRoleId : selectedDepartmentId
    if (!activeScopeId) {
      setRoleQuestionCount(0)
      setExistingRoleQuestionKeys([])
      setIsLoadingExistingQuestions(false)
      return
    }

    const loadScopeQuestions = async () => {
      try {
        setIsLoadingExistingQuestions(true)
        const response = await fetch("/api/role-questions", {
          credentials: "include",
        })

        if (!response.ok) {
          setRoleQuestionCount(0)
          setExistingRoleQuestionKeys([])
          setQuestions([createEmptyQuestion(0)])
          setCurrentQuestionIndex(0)
          return
        }

        const allQuestions = (await response.json()) as unknown
        const rows: ApiRoleQuestion[] = Array.isArray(allQuestions) ? (allQuestions as ApiRoleQuestion[]) : []

        const scopeQuestions = rows
          .filter((q) => {
            if (questionScope === "role") return asString(q?.role_id) === selectedRoleId
            return asString(q?.department_id) === selectedDepartmentId
          })
          .sort((a, b) => (asNumber(a?.display_order) ?? 0) - (asNumber(b?.display_order) ?? 0))

        setRoleQuestionCount(scopeQuestions.length)
        const keys = scopeQuestions.map((q) => asString(q.question_key) ?? "").filter(Boolean)
        setExistingRoleQuestionKeys(keys)

        if (scopeQuestions.length === 0) {
          setQuestions([createEmptyQuestion(0)])
          setCurrentQuestionIndex(0)
          return
        }

        const mapped: QuestionFormData[] = scopeQuestions.map((q, index: number) => {
          const id = asString(q.id)
          const label = asString(q.question_label) ?? ""
          const type = asString(q.question_type) ?? "textarea"
          const description = asString(q.question_description) ?? ""
          const placeholder = asString(q.placeholder) ?? ""

          return {
            id: id ?? `existing-${Date.now()}-${Math.random()}`,
            question_label: label,
            question_type: type,
            question_description: description,
            placeholder,
            options: Array.isArray(q.options) ? (q.options as string[]) : null,
            is_required: Boolean(q.is_required),
            display_order: asNumber(q.display_order) ?? index,
            min_value: asNumber(q.min_value),
            max_value: asNumber(q.max_value),
            min_length: asNumber(q.min_length) as number | null,
            max_length: asNumber(q.max_length) as number | null,
            pattern: asString(q.pattern) ?? "",
            step: asNumber(q.step),
            min_date: asString(q.min_date) ?? "",
            max_date: asString(q.max_date) ?? "",
            is_active: q.is_active !== false,
          }
        })

        setQuestions(mapped)
        setCurrentQuestionIndex(0)
      } catch (error) {
        console.error("Error loading role questions:", error)
      } finally {
        setIsLoadingExistingQuestions(false)
      }
    }

    loadScopeQuestions()
  }, [questionScope, selectedRoleId, selectedDepartmentId])

  // Initialize with one empty question only after a scope is selected
  useEffect(() => {
    const hasScope = questionScope === "role" ? !!selectedRole : !!selectedDepartment
    if (!hasScope) return
    if (questions.length !== 0) return

    setQuestions([createEmptyQuestion(0)])
    setCurrentQuestionIndex(0)
  }, [questionScope, selectedRole, selectedDepartment, questions.length])

  const addQuestion = () => {
    const nextIndex = questions.length
    setQuestions([...questions, createEmptyQuestion(nextIndex)])
    setCurrentQuestionIndex(nextIndex)
  }

  const removeQuestion = (id: string) => {
    const newQuestions = questions.filter((q) => q.id !== id)
    const reordered = newQuestions.map((q, index) => ({
      ...q,
      display_order: index,
    }))
    setQuestions(reordered)
    if (currentQuestionIndex >= reordered.length) {
      setCurrentQuestionIndex(Math.max(0, reordered.length - 1))
    }
  }

  const updateQuestion = (id: string, updates: Partial<QuestionFormData>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)))
  }

  const handleRoleSelect = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (role) {
      setQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedRole(role)
    }
  }

  const handleDepartmentSelect = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId)
    if (department) {
      setQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedDepartment(department)
    }
  }

  const validateQuestions = useCallback((): boolean => {
    if (questions.length === 0) {
      toast.error("Please add at least one question")
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      if (!q.question_label?.trim()) {
        toast.error(`Question ${i + 1}: Question label is required`)
        return false
      }

      if (!q.question_type) {
        toast.error(`Question ${i + 1}: Question type is required`)
        return false
      }

      if (
        (q.question_type === "select" ||
          q.question_type === "multiselect" ||
          q.question_type === "radio" ||
          q.question_type === "rating") &&
        (!q.options || q.options.length === 0)
      ) {
        toast.error(`Question ${i + 1}: Options are required for this question type`)
        return false
      }
    }

    return true
  }, [questions])

  const handleSubmit = useCallback(async () => {
    const scopeOk = questionScope === "role" ? !!selectedRole : !!selectedDepartment
    if (!validateQuestions() || !scopeOk || !user) return

    try {
      setIsSubmitting(true)

      const usedKeys = new Set<string>()
      const existingKeys = new Set(existingRoleQuestionKeys)

      const questionsToSubmit = questions.map((q, index) => {
        const baseKey = toQuestionKey(q.question_label) || `question_${index + 1}`
        let uniqueKey = baseKey
        let suffix = 2
        while (usedKeys.has(uniqueKey) || existingKeys.has(uniqueKey)) {
          uniqueKey = `${baseKey}_${suffix}`
          suffix += 1
        }
        usedKeys.add(uniqueKey)

        const includeId = typeof q.id === "string" && !q.id.startsWith("temp-")

        const scopeFields =
          questionScope === "role" ? { role_id: selectedRole!.id } : { department_id: selectedDepartment!.id }

        return {
          ...(includeId ? { id: q.id } : {}),
          ...scopeFields,
          question_label: q.question_label.trim(),
          question_type: q.question_type,
          question_description: q.question_description?.trim() || null,
          placeholder: q.placeholder?.trim() || null,
          options: q.options && q.options.length > 0 ? q.options : null,
          is_required: q.is_required,
          display_order: q.display_order,
          validation_rules: null,
          is_active: q.is_active,
          metadata: {
            legacy_question_key: uniqueKey,
          },
          min_value: q.min_value,
          max_value: q.max_value,
          min_length: q.min_length,
          max_length: q.max_length,
          pattern: q.pattern?.trim() || null,
          step: q.step,
          min_date: q.min_date || null,
          max_date: q.max_date || null,
          conditional_logic: null,
        }
      })

      const response = await fetch("/api/admin/role-questions/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questions: questionsToSubmit }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save questions")
      }

      const saved = Array.isArray(result?.data) ? (result.data as SavedQuestion[]) : ([] as SavedQuestion[])
      setCreatedQuestions(saved)
      setCurrentStep("success")
      setRoleQuestionCount(saved.length)
      setExistingRoleQuestionKeys(Array.from(existingKeys))
      toast.success(`Successfully saved ${saved.length || 0} question(s)`)
    } catch (error: unknown) {
      console.error("Error saving questions:", error)
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save questions"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [existingRoleQuestionKeys, questionScope, questions, selectedDepartment, selectedRole, user, validateQuestions])

  useEffect(() => {
    const onSubmit = () => {
      void handleSubmit()
    }

    window.addEventListener("role-questions:submit", onSubmit)
    return () => {
      window.removeEventListener("role-questions:submit", onSubmit)
    }
  }, [handleSubmit])

  // Render Role Selection Step
  const roleSelection = (
    <Card className="border-gray-200 p-6 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Users className="h-5 w-5" />
          Target Audience
        </CardTitle>
        <CardDescription className="text-gray-600">Choose who will answer these questions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scope">Scope</Label>
          <Select
            value={questionScope}
            onValueChange={(val) => {
              const next = val === "department" ? "department" : "role"
              setQuestionScope(next)
              setSelectedRole(null)
              setSelectedDepartment(null)
              setQuestions([])
              setCurrentQuestionIndex(0)
              setRoleQuestionCount(0)
              setExistingRoleQuestionKeys([])
            }}
          >
            <SelectTrigger id="scope" className="mt-1.5" aria-describedby="scope-description">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role" aria-describedby="role-help">
                Role-based
              </SelectItem>
              <SelectItem value="department" aria-describedby="department-help">
                Department-based
              </SelectItem>
            </SelectContent>
          </Select>
          <p id="scope-description" className="mt-1.5 text-xs text-gray-500">
            {questionScope === "role"
              ? "Questions will be assigned to specific job roles"
              : "Questions will be assigned to entire departments"}
          </p>
        </div>

        {isLoadingRoles || isLoadingDepartments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {questionScope === "role" ? (
              <div className="space-y-2">
                <Label htmlFor="target-role">Select Role</Label>
                <Select value={selectedRole?.id || ""} onValueChange={handleRoleSelect}>
                  <SelectTrigger id="target-role" className="mt-1.5">
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="role-help" className="mt-1.5 text-xs text-gray-500">
                  Questions will be assigned to specific job roles
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="target-department">Select Department</Label>
                <Select value={selectedDepartment?.id || ""} onValueChange={handleDepartmentSelect}>
                  <SelectTrigger id="target-department" className="mt-1.5">
                    <SelectValue placeholder={isLoadingDepartments ? "Loading..." : "Choose a department..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="department-help" className="mt-1.5 text-xs text-gray-500">
                  Questions will be assigned to entire departments
                </p>
              </div>
            )}

            {isLoadingExistingQuestions && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading existing questions...
              </div>
            )}

            {questionScope === "role" && selectedRole && (
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

            {questionScope === "department" && selectedDepartment && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>
                      Selected: <strong>{selectedDepartment.name}</strong>
                    </span>
                    <Badge variant="secondary">
                      {roleQuestionCount} existing question{roleQuestionCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )

  // Render Success Step
  if (currentStep === "success") {
    const targetName =
      questionScope === "role" ? selectedRole?.name : questionScope === "department" ? selectedDepartment?.name : null

    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle>Questions Saved Successfully!</CardTitle>
          </div>
          <CardDescription>
            {createdQuestions.length} question{createdQuestions.length !== 1 ? "s" : ""} saved for {targetName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Saved Questions:</h3>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {createdQuestions.map((q, index) => (
                <div key={q.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{q.question_label || ""}</span>
                        <Badge variant="secondary">{q.question_type || ""}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                setCreatedQuestions([])
                setQuestions((prev) => {
                  const existing = prev.length > 0 ? prev : [createEmptyQuestion(0)]
                  return [...existing, createEmptyQuestion(existing.length)]
                })
                setCurrentQuestionIndex(0)
                setCurrentStep("questions")
              }}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create More Questions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRole(null)
                setSelectedDepartment(null)
                setQuestions([])
                setCurrentQuestionIndex(0)
                setCreatedQuestions([])
                setCurrentStep("questions")
              }}
              className="flex-1"
            >
              Create for Another
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/questions")} className="flex-1">
              View All Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render Questions Step (wizard mode)
  const hasScope = questionScope === "role" ? !!selectedRole : !!selectedDepartment
  const selectedScopeName =
    questionScope === "role" ? selectedRole?.name : questionScope === "department" ? selectedDepartment?.name : null

  return (
    <div className="space-y-6">
      {roleSelection}

      {!hasScope && (
        <Card>
          <CardContent className="py-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Shield className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium">
                  {questionScope === "role" ? "Select a role to start" : "Select a department to start"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {questionScope === "role"
                    ? "Choose the role above. Then you’ll create the questions users for that role will answer when submitting reports."
                    : "Choose the department above. Then you’ll create the questions users for that department will answer when submitting reports."}
                </p>
              </div>
              <div className="pt-2">
                <Button variant="outline" onClick={() => router.push("/admin/questions")}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasScope && questions.length > 0 && (
        <>
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create Questions for {selectedScopeName || ""}</CardTitle>
                  <CardDescription>{`Selected: Question ${Math.min(currentQuestionIndex + 1, questions.length)} of ${questions.length}`}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {questions.length} question{questions.length !== 1 ? "s" : ""}
                  </Badge>
                  <Button variant="outline" onClick={addQuestion} disabled={isSubmitting} size="default">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting || questions.length === 0} size="default">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Create {questions.length} Question{questions.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Questions Form */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={idx === currentQuestionIndex ? "ring-primary/20 rounded-xl ring-2" : ""}
                    onClick={() => setCurrentQuestionIndex(idx)}
                  >
                    <QuestionForm
                      question={q}
                      index={idx}
                      onUpdate={(updates) => updateQuestion(q.id, updates)}
                      onRemove={() => removeQuestion(q.id)}
                      canRemove={questions.length > 1}
                    />
                  </div>
                ))}

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        className="w-full sm:flex-1"
                        onClick={addQuestion}
                        disabled={isSubmitting}
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full sm:flex-1"
                        onClick={() => router.push("/admin/questions")}
                        disabled={isSubmitting}
                        type="button"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Live Preview</CardTitle>
                        <CardDescription>Preview active questions as users will see them</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview((v) => !v)}
                        aria-label={showPreview ? "Hide preview" : "Show preview"}
                      >
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {showPreview ? (
                      <div className="space-y-6">
                        {questions.filter((qq) => qq.is_active).length === 0 ? (
                          <div className="text-muted-foreground py-10 text-center text-sm">No active questions.</div>
                        ) : (
                          questions
                            .filter((qq) => qq.is_active)
                            .map((qq, i) => (
                              <div key={qq.id} className="space-y-3">
                                {i > 0 && <Separator />}
                                <QuestionPreview question={qq} isPreviewMode={true} displayIndex={i} />
                              </div>
                            ))
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center text-sm">
                        <Eye className="mb-2 h-8 w-8 opacity-50" />
                        Preview hidden
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Questions</span>
                      <Badge>{questions.length}</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active</span>
                      <Badge variant="secondary">{questions.filter((qq) => qq.is_active).length}</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Required</span>
                      <Badge variant="secondary">{questions.filter((qq) => qq.is_required).length}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}
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

  useEffect(() => {
    if (question.options) {
      setOptionInput("")
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
            <Badge variant="outline">Q{index + 1}</Badge>
            <CardTitle className="text-lg">Question {index + 1}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-3 pr-1 sm:flex">
              <div className="flex items-center gap-2">
                <Switch checked={question.is_active} onCheckedChange={(checked) => onUpdate({ is_active: checked })} />
                <span className="text-muted-foreground text-xs">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={question.is_required}
                  onCheckedChange={(checked) => onUpdate({ is_required: checked })}
                />
                <span className="text-muted-foreground text-xs">Required</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {canRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              Question Type <span className="text-destructive">*</span>
            </Label>
            <Select value={question.question_type} onValueChange={(value) => onUpdate({ question_type: value })}>
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

          <div className="space-y-2">
            <Label>
              Question Label <span className="text-destructive">*</span>
            </Label>
            <Input
              value={question.question_label}
              onChange={(e) => onUpdate({ question_label: e.target.value })}
              placeholder="What is your project name?"
              className="bg-[#f3f3f5]"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={question.question_description}
              onChange={(e) => onUpdate({ question_description: e.target.value })}
              placeholder="Additional context for the question"
              rows={2}
              className="bg-[#f3f3f5]"
            />
          </div>

          <div className="space-y-2">
            <Label>Placeholder</Label>
            <Input
              value={question.placeholder}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="Enter placeholder text"
              className="bg-[#f3f3f5]"
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
                  className="bg-[#f3f3f5]"
                />
                <Button type="button" onClick={addOption}>
                  Add
                </Button>
              </div>
              {question.options && question.options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
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

          <div className="space-y-4">
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
                      className="bg-[#f3f3f5]"
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
                      className="bg-[#f3f3f5]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pattern (Regex)</Label>
                  <Input
                    value={question.pattern}
                    onChange={(e) => onUpdate({ pattern: e.target.value })}
                    placeholder="e.g., ^[A-Za-z]+$"
                    className="bg-[#f3f3f5]"
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
                    className="bg-[#f3f3f5]"
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
                    className="bg-[#f3f3f5]"
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
                    className="bg-[#f3f3f5]"
                  />
                </div>
              </div>
            )}

            {/* Date validation */}
            {(question.question_type === "date" || question.question_type === "datetime") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Date</Label>
                  <Input
                    type="date"
                    value={question.min_date}
                    onChange={(e) => onUpdate({ min_date: e.target.value })}
                    className="bg-[#f3f3f5]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Date</Label>
                  <Input
                    type="date"
                    value={question.max_date}
                    onChange={(e) => onUpdate({ max_date: e.target.value })}
                    className="bg-[#f3f3f5]"
                  />
                </div>
              </div>
            )}
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
  displayIndex?: number
}

function QuestionPreview({ question, isPreviewMode = false, displayIndex }: QuestionPreviewProps) {
  const [previewValue, setPreviewValue] = useState<string>("")
  const [previewError, setPreviewError] = useState<string>("")
  const [touched, setTouched] = useState(false)

  // Initialize with default value and update when question changes
  useEffect(() => {
    if (question.question_type === "multiselect") {
      setPreviewValue("[]")
    } else if (question.question_type === "checkbox") {
      setPreviewValue("false")
    } else {
      setPreviewValue("")
    }
    // Reset validation state when question changes
    setTouched(false)
    setPreviewError("")
  }, [question.question_type, question.id])

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
        } catch {
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
    <div className={`space-y-4 ${isPreviewMode ? "" : ""}`}>
      {/* Question Label with Required Indicator */}
      <Label
        htmlFor={isPreviewMode ? `preview-${question.id}` : undefined}
        className={`${isPreviewMode ? "text-base" : "text-sm"} block font-medium`}
      >
        {typeof displayIndex === "number" ? `Q${displayIndex + 1}. ` : ""}
        {question.question_label || "Question Label"}
        {question.is_required && <span className="text-destructive ml-2">*</span>}
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
          id={isPreviewMode ? `preview-${question.id}` : undefined}
          type="text"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || ""}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          pattern={question.pattern || undefined}
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
        />
      )}

      {question.question_type === "textarea" && (
        <Textarea
          id={isPreviewMode ? `preview-${question.id}` : undefined}
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={question.placeholder || ""}
          rows={4}
          required={question.is_required}
          minLength={question.min_length || undefined}
          maxLength={question.max_length || undefined}
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
        />
      )}

      {question.question_type === "time" && (
        <Input
          type="time"
          value={previewValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={question.is_required}
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
        />
      )}

      {question.question_type === "select" && question.options && (
        <Select value={previewValue} onValueChange={handleChange} required={question.is_required}>
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
        <RadioGroup value={previewValue} onValueChange={handleChange} required={question.is_required}>
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
        <div className="space-y-4">
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
                    const newValues = checked ? [...current, option] : current.filter((v) => v !== option)
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
          className={`bg-[#f3f3f5]${previewError ? "border-destructive" : ""}`}
        />
      )}

      {/* Validation Error Message - Only show in preview mode when there's an error */}
      {isPreviewMode && touched && previewError && (
        <p className="text-destructive mt-2 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          {previewError}
        </p>
      )}

      {/* Validation Success Indicator - Only in edit mode, not in clean preview */}
      {!isPreviewMode && touched && !previewError && previewValue && (
        <p className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Valid
        </p>
      )}
    </div>
  )
}
