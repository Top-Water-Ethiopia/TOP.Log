"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Save,
  X,
  Users,
  FileText,
  ChevronRight,
} from "lucide-react"
import { findDuplicateValues, normalizeQuestionKey } from "@/lib/role-question-identity"
import { isDepartmentReportQuestion, matchesProfessionQuestion } from "@/lib/reporting-model"
import {
  ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
  getAssignedAgentsDailyLimit,
  getQuestionOptionSource,
  isSalesPromoterProfessionKey,
  MARKETING_DEPARTMENT_NAME,
  SALES_PROMOTER_PROFESSION_KEY,
  normalizeSalesPromoterProfessionKey,
} from "@/lib/marketing-agents"
import { toast } from "sonner"
import { useScopeEntryKinds, type ScopeEntryKind } from "@/hooks/use-entry-kinds"
import {
  getEntryKindLabel,
  getEntryKindColor,
  getEntryKindIcon,
  getDefaultEntryKind,
  findEntryKindConfig,
} from "@/lib/entry-kinds"

type ApiRoleQuestion = {
  id?: unknown
  role_id?: unknown
  department_id?: unknown
  department_profession_id?: unknown
  department_role?: unknown
  entry_kind?: unknown
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
  metadata?: unknown
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

function createEmptyQuestion(displayOrder = 0, defaultEntryKind: string = "standard"): QuestionFormData {
  return {
    id: `temp-${Date.now()}-${Math.random()}`,
    question_key: "",
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
    option_source_kind: "static",
    max_logs_per_agent_per_day: null,
    entry_kind: defaultEntryKind,
  }
}

export function questionTypeSupportsStaticOptions(questionType: string): boolean {
  return (
    questionType === "select" ||
    questionType === "multiselect" ||
    questionType === "radio" ||
    questionType === "rating" ||
    questionType === "checkbox"
  )
}

export function filterQuestionsForEntryKind(questions: QuestionFormData[], entryKind: string): QuestionFormData[] {
  return questions.filter((q) => {
    if (entryKind === "standard") {
      return !q.entry_kind || q.entry_kind === "standard"
    }
    return q.entry_kind === entryKind
  })
}

export function removeQuestionFromList(questions: QuestionFormData[], id: string): QuestionFormData[] {
  return questions
    .filter((q) => q.id !== id)
    .map((q, index) => ({
      ...q,
      display_order: index,
    }))
}

interface Department {
  id: string
  name: string
  description: string | null
}

interface DepartmentRole {
  id?: string
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  department_id?: string
}

interface QuestionFormData {
  id: string // Temporary ID for tracking
  question_key: string
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
  option_source_kind: "static" | typeof ASSIGNED_AGENTS_OPTION_SOURCE_KIND
  max_logs_per_agent_per_day: number | null
  entry_kind?: string
}

function normalizeQuestionEntryKind(entryKind: string | null | undefined, fallbackEntryKind: string): string {
  return typeof entryKind === "string" && entryKind.trim().length > 0 ? entryKind : fallbackEntryKind
}

export function sanitizeQuestionsForScope(
  questions: QuestionFormData[],
  entryKinds: ScopeEntryKind[],
  fallbackEntryKind: string,
  preferredActiveEntryKindTab?: string | null
): { questions: QuestionFormData[]; activeEntryKindTab: string } {
  const configuredEntryKinds = new Set(entryKinds.map((entryKind) => entryKind.entry_kind))
  const nextActiveTab = entryKinds.find((entryKind) => entryKind.is_active && entryKind.is_default)?.entry_kind
    || entryKinds.find((entryKind) => entryKind.is_active)?.entry_kind
    || fallbackEntryKind
  const preferredActiveTab =
    preferredActiveEntryKindTab && entryKinds.some((entryKind) => entryKind.is_active && entryKind.entry_kind === preferredActiveEntryKindTab)
      ? preferredActiveEntryKindTab
      : null

  if (entryKinds.length === 0) {
    const normalizedQuestions =
      questions.length > 0
        ? questions.map((question, index) => ({
            ...question,
            display_order: index,
            entry_kind: normalizeQuestionEntryKind(question.entry_kind, fallbackEntryKind),
          }))
        : [createEmptyQuestion(0, fallbackEntryKind)]

    return {
      questions: normalizedQuestions,
      activeEntryKindTab: preferredActiveTab || nextActiveTab,
    }
  }

  const filteredQuestions = questions
    .filter((question) => configuredEntryKinds.has(normalizeQuestionEntryKind(question.entry_kind, fallbackEntryKind)))
    .map((question, index) => ({
      ...question,
      display_order: index,
      entry_kind: normalizeQuestionEntryKind(question.entry_kind, fallbackEntryKind),
    }))

  if (filteredQuestions.length === 0) {
    return {
      questions: [createEmptyQuestion(0, nextActiveTab)],
      activeEntryKindTab: preferredActiveTab || nextActiveTab,
    }
  }

  const firstQuestionTab = filteredQuestions.find(
    (question) => question.entry_kind && configuredEntryKinds.has(question.entry_kind)
  )?.entry_kind

  return {
    questions: filteredQuestions,
    activeEntryKindTab: preferredActiveTab || firstQuestionTab || nextActiveTab || fallbackEntryKind,
  }
}

type Step = "role" | "questions" | "success"
type QuestionScope = "role" | "department"

export function buildQuestionScopeFields(
  questionScope: QuestionScope,
  selectedDepartment: Department | null,
  selectedDepartmentForRole: Department | null,
  selectedDepartmentRole: DepartmentRole | null
) {
  if (questionScope === "role") {
    return {
      department_id: selectedDepartmentForRole!.id,
      department_profession_id: selectedDepartmentRole!.id ?? null,
      department_role: normalizeSalesPromoterProfessionKey(selectedDepartmentRole!.key),
    }
  }

  return { department_id: selectedDepartment!.id }
}

export function RoleQuestionsCreator() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSupabaseAuth()
  const didApplyUrlDefaultsRef = useRef(false)
  const [currentStep, setCurrentStep] = useState<Step>("questions")
  const [questionScope, setQuestionScope] = useState<QuestionScope>("role")
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const selectedDepartmentId = selectedDepartment?.id
  const [departmentRoles, setDepartmentRoles] = useState<DepartmentRole[]>([])
  const [isLoadingDepartmentRoles, setIsLoadingDepartmentRoles] = useState(false)
  const [selectedDepartmentRole, setSelectedDepartmentRole] = useState<DepartmentRole | null>(null)
  const [selectedDepartmentForRole, setSelectedDepartmentForRole] = useState<Department | null>(null)
  const [isLoadingExistingQuestions, setIsLoadingExistingQuestions] = useState(false)
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [activeEntryKindTab, setActiveEntryKindTab] = useState<string>("standard")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdQuestions, setCreatedQuestions] = useState<SavedQuestion[]>([])
  const [roleQuestionCount, setRoleQuestionCount] = useState(0)
  const [showPreview, setShowPreview] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Scope-partitioned drafts: store unsaved questions per scope
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, QuestionFormData[]>>({})

  // Fetch scope entry kinds for dynamic tabs
  const isRoleScope = questionScope === "role"
  const targetDepartmentId = isRoleScope ? selectedDepartmentForRole?.id : selectedDepartment?.id
  const targetProfessionId = isRoleScope ? selectedDepartmentRole?.key : null

  const {
    entryKinds,
    scope,
    selfHealed,
    isLoading: isLoadingEntryKinds,
    error: entryKindsError,
    mutate: mutateEntryKinds,
  } = useScopeEntryKinds(targetDepartmentId || null, targetProfessionId || null)

  const scopeKey = useMemo(() => {
    if (!targetDepartmentId) return null
    return `${targetDepartmentId}:${targetProfessionId || "department"}`
  }, [targetDepartmentId, targetProfessionId])

  // Get active entry kinds sorted
  const activeEntryKinds = useMemo(() => {
    return entryKinds
      .filter((k) => k.is_active)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.label.localeCompare(b.label)
      })
  }, [entryKinds])

  // Get default entry kind
  const defaultEntryKind = useMemo(() => {
    const defaultConfig = activeEntryKinds.find((k) => k.is_default)
    return defaultConfig?.entry_kind || activeEntryKinds[0]?.entry_kind || "standard"
  }, [activeEntryKinds])

  const canEditForScope = useMemo(() => {
    if (!targetDepartmentId) return false
    if (isLoadingEntryKinds) return false
    if (entryKindsError) return false
    if (activeEntryKinds.length === 0) return false
    return true
  }, [activeEntryKinds.length, entryKindsError, isLoadingEntryKinds, targetDepartmentId])

  useEffect(() => {
    if (!scopeKey) return
    if (isLoadingEntryKinds) return
    const draft = scopeDrafts[scopeKey]
    if (!draft || draft.length === 0) return

    if (hasUnsavedChanges) return

    const sanitized = sanitizeQuestionsForScope(draft, entryKinds, defaultEntryKind, activeEntryKindTab)
    setQuestions(sanitized.questions)
    setCurrentQuestionIndex(0)
    setActiveEntryKindTab(sanitized.activeEntryKindTab)
  }, [activeEntryKindTab, defaultEntryKind, entryKinds, hasUnsavedChanges, isLoadingEntryKinds, scopeDrafts, scopeKey])

  const persistCurrentDraft = useCallback(() => {
    if (!scopeKey) return
    if (!hasUnsavedChanges) return
    setScopeDrafts((prev) => ({ ...prev, [scopeKey]: questions }))
  }, [hasUnsavedChanges, questions, scopeKey])

  const confirmScopeSwitchIfDirty = useCallback(() => {
    if (!hasUnsavedChanges) return true
    return window.confirm("You have unsaved changes. Switch scope and keep this draft for later?")
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (didApplyUrlDefaultsRef.current) return

    const scopeParam = searchParams?.get("scope")
    const departmentIdParam = searchParams?.get("departmentId")
    const roleIdParam = searchParams?.get("roleId") || searchParams?.get("role")

    const effectiveScope =
      scopeParam === "role" || (!scopeParam && roleIdParam) || (scopeParam === "department" && roleIdParam)
        ? "role"
        : "department"

    if (effectiveScope === "department") {
      if (isLoadingDepartments) return
      setQuestionScope("department")
      if (departmentIdParam) {
        const dept = departments.find((d) => d.id === departmentIdParam) || null
        setSelectedDepartment(dept)
      }
      didApplyUrlDefaultsRef.current = true
      return
    }

    if (effectiveScope === "role") {
      if (isLoadingDepartments) return
      setQuestionScope("role")

      if (!departmentIdParam) {
        didApplyUrlDefaultsRef.current = true
        return
      }

      const dept = departments.find((d) => d.id === departmentIdParam) || null
      if (!dept) {
        didApplyUrlDefaultsRef.current = true
        return
      }

      setSelectedDepartmentForRole(dept)
      setSelectedDepartmentRole(null)
      setDepartmentRoles([])

      void (async () => {
        const roles = await loadDepartmentRoles(dept.id)
        if (roleIdParam) {
          const found = roles.find((r) => r.key === roleIdParam || r.id === roleIdParam) || null
          setSelectedDepartmentRole(found)
        }
        didApplyUrlDefaultsRef.current = true
      })()
      return
    }
  }, [searchParams, departments, isLoadingDepartments])

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

  // Load existing question count for selected scope
  useEffect(() => {
    const hasScope =
      questionScope === "role" ? !!selectedDepartmentForRole && !!selectedDepartmentRole : !!selectedDepartment
    if (!hasScope) {
      setRoleQuestionCount(0)
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
          setQuestions([createEmptyQuestion(0)])
          setCurrentQuestionIndex(0)
          return
        }

        const allQuestions = (await response.json()) as unknown
        const rows: ApiRoleQuestion[] = Array.isArray(allQuestions) ? (allQuestions as ApiRoleQuestion[]) : []

        const isRoleScope = questionScope === "role"
        const targetDeptId = isRoleScope ? selectedDepartmentForRole!.id : selectedDepartmentId
        const targetRoleKey = isRoleScope ? selectedDepartmentRole!.key : null

        const scopeQuestions = rows
          .filter((q) => {
            const matchesDept = asString(q?.department_id) === targetDeptId
            if (!matchesDept) return false
            if (isRoleScope) {
              return matchesProfessionQuestion(q, targetDeptId, {
                professionId: selectedDepartmentRole?.id || null,
                professionKey: targetRoleKey,
              })
            }
            return isDepartmentReportQuestion(q)
          })
          .sort((a, b) => (asNumber(a?.display_order) ?? 0) - (asNumber(b?.display_order) ?? 0))

        setRoleQuestionCount(scopeQuestions.length)

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
            question_key: asString(q.question_key) ?? "",
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
            option_source_kind:
              getQuestionOptionSource(q.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
                ? ASSIGNED_AGENTS_OPTION_SOURCE_KIND
                : "static",
            max_logs_per_agent_per_day: getAssignedAgentsDailyLimit(q.metadata),
            entry_kind: (asString(q.entry_kind) as string) || "standard",
          }
        })

        setQuestions(mapped)
        setCurrentQuestionIndex(0)
        setHasUnsavedChanges(false)
      } catch (error) {
        console.error("Error loading role questions:", error)
      } finally {
        setIsLoadingExistingQuestions(false)
      }
    }

    loadScopeQuestions()
  }, [
    questionScope,
    selectedDepartmentId,
    selectedDepartmentForRole,
    selectedDepartmentRole,
    selectedDepartment,
  ])

  useEffect(() => {
    if (isLoadingEntryKinds || entryKinds.length === 0 || questions.length === 0) {
      return
    }

    const sanitized = sanitizeQuestionsForScope(questions, entryKinds, defaultEntryKind, activeEntryKindTab)
    const questionsChanged =
      sanitized.questions.length !== questions.length ||
      sanitized.questions.some((question, index) => {
        const currentQuestion = questions[index]
        return (
          currentQuestion?.id !== question.id ||
          currentQuestion?.entry_kind !== question.entry_kind ||
          currentQuestion?.display_order !== question.display_order
        )
      })

    if (questionsChanged) {
      setQuestions(sanitized.questions)
      setCurrentQuestionIndex(0)
      setHasUnsavedChanges(false)
    }

    if (activeEntryKindTab !== sanitized.activeEntryKindTab) {
      setActiveEntryKindTab(sanitized.activeEntryKindTab)
    }
  }, [activeEntryKindTab, defaultEntryKind, entryKinds, isLoadingEntryKinds, questions])

  // Initialize with one empty question only after a scope is selected
  useEffect(() => {
    const hasScope =
      questionScope === "role" ? !!selectedDepartmentForRole && !!selectedDepartmentRole : !!selectedDepartment
    if (!hasScope) return
    if (questions.length !== 0) return

    // Use the default entry kind from active entry kinds configuration
    const initialEntryKind: string = getDefaultEntryKind(activeEntryKinds)

    // Set active tab to match default entry_kind
    setActiveEntryKindTab(initialEntryKind)

    setQuestions([createEmptyQuestion(0, initialEntryKind)])
    setCurrentQuestionIndex(0)
    setHasUnsavedChanges(false)
  }, [
    questionScope,
    selectedDepartmentForRole,
    selectedDepartmentRole,
    selectedDepartment,
    questions.length,
    activeEntryKinds,
  ])

  const addQuestion = () => {
    if (!canEditForScope) return
    // Use active tab's entry_kind for new question, but only if it's an active entry kind
    const currentTabIsActive = activeEntryKinds.some((k) => k.entry_kind === activeEntryKindTab)
    const entryKindForNewQuestion = currentTabIsActive ? activeEntryKindTab : defaultEntryKind
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length, entryKindForNewQuestion)])
    setCurrentQuestionIndex(filteredQuestions.length)
    setHasUnsavedChanges(true)
  }

  const removeQuestion = (id: string) => {
    const reordered = removeQuestionFromList(questions, id)
    const remainingVisibleQuestions = filterQuestionsForEntryKind(reordered, activeEntryKindTab)
    setQuestions(reordered)
    setHasUnsavedChanges(true)
    if (currentQuestionIndex >= remainingVisibleQuestions.length) {
      setCurrentQuestionIndex(Math.max(0, remainingVisibleQuestions.length - 1))
    }
  }

  const updateQuestion = (id: string, updates: Partial<QuestionFormData>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)))
    setHasUnsavedChanges(true)
  }

  const handleDepartmentSelect = (departmentId: string) => {
    if (!confirmScopeSwitchIfDirty()) return
    persistCurrentDraft()
    const department = departments.find((d) => d.id === departmentId)
    if (department) {
      setQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedDepartment(department)
      setHasUnsavedChanges(false)
    }
  }

  const handleDepartmentForRoleSelect = (departmentId: string) => {
    if (!confirmScopeSwitchIfDirty()) return
    persistCurrentDraft()
    const department = departments.find((d) => d.id === departmentId)
    if (department) {
      setQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedDepartmentForRole(department)
      setSelectedDepartmentRole(null)
      setHasUnsavedChanges(false)
      // Load department roles when department is selected
      void loadDepartmentRoles(department.id)
      // Update URL with departmentId
      const params = new URLSearchParams(searchParams?.toString() || "")
      params.set("departmentId", department.id)
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }

  const handleDepartmentRoleSelect = (roleKey: string) => {
    if (!confirmScopeSwitchIfDirty()) return
    persistCurrentDraft()
    const role = departmentRoles.find((r) => r.key === roleKey)
    if (role) {
      setQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedDepartmentRole(role)
      setHasUnsavedChanges(false)
      // Update URL with roleId
      const params = new URLSearchParams(searchParams?.toString() || "")
      params.set("roleId", role.key)
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }

  async function loadDepartmentRoles(departmentId: string) {
    try {
      setIsLoadingDepartmentRoles(true)
      const response = await fetch(`/api/admin/departments/${encodeURIComponent(departmentId)}/profession-roles`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to load department roles")

      const result = await response.json()
      const data = Array.isArray(result?.data) ? (result.data as DepartmentRole[]) : []
      const activeRoles = data.filter((role) => role.is_active)
      setDepartmentRoles(activeRoles)
      return activeRoles
    } catch (error: unknown) {
      console.error("Error loading department roles:", error)
      toast.error("Failed to load department roles")
      return [] as DepartmentRole[]
    } finally {
      setIsLoadingDepartmentRoles(false)
    }
  }

  // Filtered questions by entry_kind tab
  const filteredQuestions = useMemo(() => {
    return filterQuestionsForEntryKind(questions, activeEntryKindTab)
  }, [questions, activeEntryKindTab])

  // Count questions per tab - dynamic based on available entry kinds
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    // Initialize counts for all available entry kinds
    entryKinds.forEach((ek) => {
      counts[ek.entry_kind] = questions.filter((q) => q.entry_kind === ek.entry_kind).length
    })
    // Handle legacy case where entry_kind is empty or "standard"
    counts["standard"] = questions.filter((q) => !q.entry_kind || q.entry_kind === "standard").length
    return counts
  }, [questions, entryKinds])

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

      const isAssignedAgentsQuestion = q.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND

      if (
        questionTypeSupportsStaticOptions(q.question_type) &&
        !isAssignedAgentsQuestion &&
        (!q.options || q.options.length === 0)
      ) {
        toast.error(`Question ${i + 1}: Options are required for this question type`)
        return false
      }

      if (isAssignedAgentsQuestion && q.question_type !== "select" && q.question_type !== "multiselect") {
        toast.error(`Question ${i + 1}: Assigned agent questions must use the Select or Multi-Select question type`)
        return false
      }
    }

    const hasAssignedAgentsQuestion = questions.some(
      (question) => question.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
    )

    if (hasAssignedAgentsQuestion) {
      if (questionScope !== "role" || !selectedDepartmentForRole || !selectedDepartmentRole) {
        toast.error("Assigned agent questions are only supported for profession-scoped questions")
        return false
      }

      if (selectedDepartmentForRole.name.trim() !== MARKETING_DEPARTMENT_NAME) {
        toast.error("Assigned agent questions are only supported in the Marketing department")
        return false
      }

      if (!isSalesPromoterProfessionKey(selectedDepartmentRole.key)) {
        toast.error(`Assigned agent questions are only supported for the ${SALES_PROMOTER_PROFESSION_KEY} profession`)
        return false
      }
    }

    const keysByEntryKind = new Map<string, string[]>()
    questions.forEach((q, index) => {
      const entryKind = q.entry_kind || "standard"
      const effectiveKey = q.question_key.trim() || normalizeQuestionKey(q.question_label) || `question_${index + 1}`
      const keys = keysByEntryKind.get(entryKind) ?? []
      keys.push(effectiveKey)
      keysByEntryKind.set(entryKind, keys)
    })

    for (const [entryKind, keys] of keysByEntryKind.entries()) {
      const duplicateKeys = findDuplicateValues(keys)
      if (duplicateKeys.length > 0) {
        toast.error(
          `Question keys must be unique within each report type. Duplicate key: ${duplicateKeys[0]} in ${entryKind}. Update the labels so they generate different keys.`
        )
        return false
      }
    }

    return true
  }, [questionScope, questions, selectedDepartmentForRole, selectedDepartmentRole])

  const handleSubmit = useCallback(async () => {
    const scopeOk =
      questionScope === "role" ? !!selectedDepartmentForRole && !!selectedDepartmentRole : !!selectedDepartment
    if (!canEditForScope) {
      toast.error("Entry kinds are not configured for this scope. Configure entry kinds before creating questions.")
      return
    }
    if (!validateQuestions() || !scopeOk || !user) return

    try {
      setIsSubmitting(true)

      const questionsToSubmit = questions.map((q, index) => {
        const resolvedKey = q.question_key.trim() || normalizeQuestionKey(q.question_label) || `question_${index + 1}`

        const includeId = typeof q.id === "string" && !q.id.startsWith("temp-")

        const scopeFields = buildQuestionScopeFields(
          questionScope,
          selectedDepartment,
          selectedDepartmentForRole,
          selectedDepartmentRole
        )

        return {
          ...(includeId ? { id: q.id } : {}),
          ...scopeFields,
          question_label: q.question_label.trim(),
          question_type: q.question_type,
          question_description: q.question_description?.trim() || null,
          placeholder: q.placeholder?.trim() || null,
          options:
            q.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
              ? null
              : q.options && q.options.length > 0
                ? q.options
                : null,
          is_required: q.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? true : q.is_required,
          display_order: q.display_order,
          validation_rules: null,
          is_active: q.is_active,
          entry_kind: q.entry_kind || "standard",
          metadata: {
            legacy_question_key: resolvedKey,
            ...(q.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
              ? {
                  option_source: {
                    kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                    max_logs_per_agent_per_day: q.max_logs_per_agent_per_day ?? null,
                  },
                }
              : {}),
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
        const detailList = Array.isArray(result?.details)
          ? result.details
          : typeof result?.details === "string" && result.details.trim()
            ? [result.details]
            : []

        const errorMessage = detailList.length
          ? `Validation failed: ${detailList.join("; ")}`
          : result?.error || result?.message || "Failed to save questions"
        throw new Error(errorMessage)
      }

      const saved = Array.isArray(result?.data) ? (result.data as SavedQuestion[]) : ([] as SavedQuestion[])
      setCreatedQuestions(saved)
      setCurrentStep("success")
      setRoleQuestionCount(saved.length)
      setHasUnsavedChanges(false)
      toast.success(`Successfully saved ${saved.length || 0} question(s)`)
    } catch (error: unknown) {
      console.error("Error saving questions:", error)
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save questions"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    canEditForScope,
    questionScope,
    questions,
    selectedDepartment,
    selectedDepartmentForRole,
    selectedDepartmentRole,
    user,
    validateQuestions,
  ])

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
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Users className="h-5 w-5 text-blue-600" />
          Target Audience
        </CardTitle>
        <CardDescription className="text-base text-gray-600">Choose who will answer these questions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scope Selection - Department focused */}
        <div className="space-y-3">
          <Label htmlFor="scope" className="text-sm font-medium text-gray-900">
            Question Scope
          </Label>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
            <div className="flex-1 space-y-2">
              <Select
                value={questionScope}
                onValueChange={(val) => {
                  const next = val === "department" ? "department" : "role"
                  setQuestionScope(next)
                  setSelectedDepartment(null)
                  setSelectedDepartmentRole(null)
                  setSelectedDepartmentForRole(null)
                  setDepartmentRoles([])
                  setQuestions([])
                  setCurrentQuestionIndex(0)
                  setRoleQuestionCount(0)
                }}
              >
                <SelectTrigger
                  id="scope"
                  className="h-11 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Department Report
                    </div>
                  </SelectItem>
                  <SelectItem value="role">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      Specific Profession
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-gray-500">
                {questionScope === "department"
                  ? "Questions answered on behalf of the department by authorized department leaders"
                  : "Questions will be assigned to specific professions within a department"}
              </p>
            </div>
          </div>
        </div>

        {/* Department and Profession Selection - Horizontal Layout */}
        {isLoadingDepartments || isLoadingDepartmentRoles ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Loading options...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {questionScope === "role" ? (
              /* Profession-based selection - Horizontal layout */
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Department Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="target-department" className="text-sm font-medium text-gray-900">
                      Department
                    </Label>
                    <Select value={selectedDepartmentForRole?.id || ""} onValueChange={handleDepartmentForRoleSelect}>
                      <SelectTrigger
                        id="target-department"
                        className="h-11 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <SelectValue placeholder="Choose department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{dept.name}</span>
                              {dept.description && <span className="text-xs text-gray-500">{dept.description}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Profession Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="target-role" className="text-sm font-medium text-gray-900">
                      Profession
                    </Label>
                    {isLoadingDepartmentRoles ? (
                      <div className="flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <Select
                        value={selectedDepartmentRole?.key || ""}
                        onValueChange={handleDepartmentRoleSelect}
                        disabled={!selectedDepartmentForRole}
                      >
                        <SelectTrigger
                          id="target-role"
                          className="h-11 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        >
                          <SelectValue placeholder="Choose profession" />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentRoles.map((role) => (
                            <SelectItem key={role.key} value={role.key}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{role.label}</span>
                                {role.is_default && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {selectedDepartmentForRole && selectedDepartmentRole && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {selectedDepartmentRole.label} at {selectedDepartmentForRole.name}
                          </p>
                          <p className="text-xs text-blue-700">
                            Questions will be assigned to this specific profession
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {roleQuestionCount} existing
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Department-based selection */
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target-department" className="text-sm font-medium text-gray-900">
                      Department
                    </Label>
                    <Select value={selectedDepartment?.id || ""} onValueChange={handleDepartmentSelect}>
                      <SelectTrigger
                        id="target-department"
                        className="h-11 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <SelectValue placeholder={isLoadingDepartments ? "Loading..." : "Choose department"} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{dept.name}</span>
                              {dept.description && <span className="text-xs text-gray-500">{dept.description}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Additional department info slot */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">Scope Type</Label>
                    <div className="flex h-11 items-center rounded-md border border-gray-300 bg-gray-50 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-sm text-gray-700">Department Report</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedDepartment && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                          <Users className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-900">{selectedDepartment.name}</p>
                          <p className="text-xs text-green-700">
                            Questions answered on behalf of the department by authorized department leaders
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {roleQuestionCount} existing
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoadingExistingQuestions && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">Loading existing questions...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Render Success Step
  if (currentStep === "success") {
    const targetName =
      questionScope === "role"
        ? selectedDepartmentRole?.label
        : questionScope === "department"
          ? selectedDepartment?.name
          : null

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
                setSelectedDepartmentRole(null)
                setSelectedDepartmentForRole(null)
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
  const hasScope =
    questionScope === "role" ? !!selectedDepartmentForRole && !!selectedDepartmentRole : !!selectedDepartment
  const selectedScopeName =
    questionScope === "role"
      ? selectedDepartmentRole?.label
      : questionScope === "department"
        ? selectedDepartment?.name
        : null

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
                  {questionScope === "role"
                    ? "Select a department and profession to start"
                    : "Select a department to start"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {questionScope === "role"
                    ? "Choose the department and profession above. Then you’ll create the questions users in that profession will answer when submitting reports."
                    : "Choose the department above. Then you’ll create the department report questions answered on behalf of that department."}
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
                  <CardDescription>{`Total: ${questions.length} question${questions.length !== 1 ? "s" : ""} across all categories`}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={addQuestion}
                    disabled={isSubmitting || !canEditForScope}
                    size="default"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || questions.length === 0 || !canEditForScope}
                    size="default"
                  >
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

          {/* Entry Kind Tabs - Dynamic based on scope configuration */}
          {isLoadingEntryKinds ? (
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Loading tabs...</span>
            </div>
          ) : entryKindsError ? (
            <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{entryKindsError.message || "Failed to load entry kinds"}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutateEntryKinds()}
                disabled={isLoadingEntryKinds}
                className="ml-2 h-auto py-1 text-xs"
              >
                {isLoadingEntryKinds ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Retry"
                )}
              </Button>
            </div>
          ) : activeEntryKinds.length === 0 ? (
            <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-700">No entry kinds configured for this scope</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/settings/entry-kinds")}
                className="ml-2 h-auto py-1 text-xs"
              >
                Configure
              </Button>
            </div>
          ) : (
            <div className="border-b border-gray-200">
              <div className="flex space-x-1">
                {entryKinds.map((entryKind, index) => {
                  const Icon = getEntryKindIcon(entryKind.entry_kind, entryKind) === "Phone" ? Users : FileText
                  const color = getEntryKindColor(entryKind.entry_kind, entryKind)
                  const isActive = activeEntryKindTab === entryKind.entry_kind
                  const isInactive = !entryKind.is_active

                  return (
                    <button
                      key={`${entryKind.entry_kind}-${index}`}
                      onClick={() => !isInactive && setActiveEntryKindTab(entryKind.entry_kind)}
                      disabled={isInactive}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-b-2 border-blue-500 text-blue-600"
                          : isInactive
                            ? "cursor-not-allowed text-gray-300"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      }`}
                      title={isInactive ? "Inactive - cannot add new questions" : undefined}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{ color: isActive ? undefined : isInactive ? "#D1D5DB" : color }}
                      />
                      <span className={isInactive ? "line-through" : ""}>
                        {getEntryKindLabel(entryKind.entry_kind, entryKind)}
                      </span>
                      {isInactive && <span className="text-xs">(Inactive)</span>}
                      <Badge
                        variant="secondary"
                        className={`ml-1 text-xs ${isInactive ? "bg-gray-100 text-gray-400" : ""}`}
                      >
                        {questions.filter((q) => q.entry_kind === entryKind.entry_kind).length}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Questions Form */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <div className="text-muted-foreground">
                        <p className="text-sm">No questions in this category yet.</p>
                        <Button
                          variant="outline"
                          onClick={addQuestion}
                          className="mt-4"
                          disabled={isSubmitting || !canEditForScope}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Question
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  filteredQuestions.map((q, idx) => (
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
                        canRemove={filteredQuestions.length > 1 || questions.length > 1}
                        activeEntryKindTab={activeEntryKindTab}
                        onMoveEntryKind={(newEntryKind) => updateQuestion(q.id, { entry_kind: newEntryKind })}
                        entryKinds={entryKinds}
                      />
                    </div>
                  ))
                )}

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        className="w-full sm:flex-1"
                        onClick={addQuestion}
                        disabled={isSubmitting || !canEditForScope}
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
                        <CardDescription>Preview questions from active tab</CardDescription>
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
                        {filteredQuestions.filter((qq) => qq.is_active).length === 0 ? (
                          <div className="text-muted-foreground py-10 text-center text-sm">
                            No active questions in this tab.
                          </div>
                        ) : (
                          filteredQuestions
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
  activeEntryKindTab?: string
  onMoveEntryKind?: (newEntryKind: string) => void
  entryKinds?: ScopeEntryKind[]
}

function QuestionForm({
  question,
  index,
  onUpdate,
  onRemove,
  canRemove,
  activeEntryKindTab,
  onMoveEntryKind,
  entryKinds = [],
}: QuestionFormProps) {
  const [optionInput, setOptionInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const isAssignedAgentQuestion = question.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
  const showsStaticOptions = questionTypeSupportsStaticOptions(question.question_type) && !isAssignedAgentQuestion

  // Get entry kind config for current question
  const entryKindConfig = useMemo(() => {
    return entryKinds.find((k) => k.entry_kind === question.entry_kind)
  }, [entryKinds, question.entry_kind])

  // Check if current entry kind supports assigned agents
  const supportsAssignedAgents = useMemo(() => {
    return entryKindConfig?.supports_assigned_agent ?? false
  }, [entryKindConfig])

  // Check if current entry kind is legacy (not in active configs)
  const isLegacy = useMemo(() => {
    if (!question.entry_kind) return false
    return !entryKinds.some((k) => k.entry_kind === question.entry_kind)
  }, [entryKinds, question.entry_kind])

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

  const supportsDynamicOptionSource = question.question_type === "select" || question.question_type === "multiselect"

  const handleQuestionTypeChange = (value: string) => {
    if (value === "select" || value === "multiselect") {
      onUpdate({
        question_type: value,
        option_source_kind: question.option_source_kind || "static",
        max_logs_per_agent_per_day:
          question.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? question.max_logs_per_agent_per_day : null,
        is_required: isAssignedAgentQuestion ? true : question.is_required,
      })
      return
    }

    onUpdate({
      question_type: value,
      option_source_kind: "static",
      max_logs_per_agent_per_day: null,
      options:
        value === "radio" || value === "multiselect" || value === "rating" || value === "checkbox"
          ? question.options
          : value === "select"
            ? question.options
            : null,
      is_required: question.is_required,
    })
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
                  checked={isAssignedAgentQuestion ? true : question.is_required}
                  onCheckedChange={(checked) => onUpdate({ is_required: checked })}
                  disabled={isAssignedAgentQuestion}
                />
                <span className="text-muted-foreground text-xs">Required</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {onMoveEntryKind && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMoveMenu(!showMoveMenu)}
                  title="Move to another category"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {showMoveMenu && (
                  <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border bg-white p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs font-medium text-gray-500">Move to...</p>
                    {entryKinds.map((kind) => (
                      <button
                        key={kind.entry_kind}
                        className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 ${
                          question.entry_kind === kind.entry_kind ? "bg-blue-50 text-blue-700" : ""
                        }`}
                        onClick={() => {
                          onMoveEntryKind(kind.entry_kind)
                          setShowMoveMenu(false)
                        }}
                        disabled={question.entry_kind === kind.entry_kind}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kind.color || "#6B7280" }} />
                          <span>{kind.label || kind.entry_kind}</span>
                          {!kind.is_active && <span className="text-xs text-gray-400">(Inactive)</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            <Select value={question.question_type} onValueChange={handleQuestionTypeChange}>
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

          {/* Entry Kind Badge - Display only, no editing */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: entryKindConfig?.color || "#6B7280",
                backgroundColor: entryKindConfig?.color ? `${entryKindConfig.color}20` : "#F3F4F6",
                color: entryKindConfig?.color || "#374151",
              }}
            >
              {entryKindConfig?.label || question.entry_kind || "Standard"}
            </Badge>
            {isLegacy && (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-xs text-orange-700">
                Legacy
              </Badge>
            )}
            {entryKindConfig && !entryKindConfig.is_active && (
              <Badge variant="outline" className="border-gray-200 bg-gray-100 text-xs text-gray-500">
                Inactive
              </Badge>
            )}
          </div>

          {/* Legacy warning */}
          {isLegacy && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              This question uses a legacy entry kind that is no longer configured. You can still edit and save it, but
              consider moving it to an active category.
            </div>
          )}

          {supportsDynamicOptionSource && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <Label>Option source</Label>
                <p className="text-muted-foreground text-xs">
                  Choose whether this field uses fixed options or loads assigned agents dynamically.
                </p>
              </div>
              <RadioGroup
                value={question.option_source_kind}
                onValueChange={(value) =>
                  onUpdate({
                    option_source_kind:
                      value === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? ASSIGNED_AGENTS_OPTION_SOURCE_KIND : "static",
                    max_logs_per_agent_per_day:
                      value === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? question.max_logs_per_agent_per_day : null,
                    is_required: value === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? true : question.is_required,
                    options: value === ASSIGNED_AGENTS_OPTION_SOURCE_KIND ? null : question.options,
                  })
                }
              >
                <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <RadioGroupItem value="static" id={`question-${question.id}-source-static`} />
                  <div className="space-y-1">
                    <Label htmlFor={`question-${question.id}-source-static`} className="cursor-pointer font-medium">
                      Static options
                    </Label>
                    <p className="text-muted-foreground text-xs">Admins manually define the available choices.</p>
                  </div>
                </div>
                <div
                  className={`flex items-start gap-3 rounded-md border border-slate-200 p-3 ${
                    supportsAssignedAgents ? "bg-white" : "cursor-not-allowed bg-slate-100 opacity-60"
                  }`}
                >
                  <RadioGroupItem
                    value={ASSIGNED_AGENTS_OPTION_SOURCE_KIND}
                    id={`question-${question.id}-source-assigned-agents`}
                    disabled={!supportsAssignedAgents}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor={`question-${question.id}-source-assigned-agents`}
                      className={`font-medium ${supportsAssignedAgents ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      Assigned agents
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {supportsAssignedAgents
                        ? question.question_type === "multiselect"
                          ? "Loads assigned agents dynamically at report time. Report users will choose one or more agents from a checkbox list."
                          : "Loads assigned agents dynamically at report time. This field is required and does not use static options."
                        : `This entry kind (${entryKindConfig?.label || question.entry_kind}) does not support assigned agents.`}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

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
          {showsStaticOptions && (
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

          {question.question_type === "select" && isAssignedAgentQuestion ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              This dropdown will load assigned agents for the logged-in Sales Promoter at report time. Static options
              are disabled for this question.
            </div>
          ) : null}

          {supportsDynamicOptionSource && isAssignedAgentQuestion ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Label htmlFor={`question-${question.id}-agent-limit`}>Max logs per agent per day</Label>
              <Select
                value={
                  question.max_logs_per_agent_per_day === null
                    ? "unlimited"
                    : String(question.max_logs_per_agent_per_day)
                }
                onValueChange={(value) =>
                  onUpdate({
                    max_logs_per_agent_per_day: value === "unlimited" ? null : Number.parseInt(value, 10) || null,
                  })
                }
              >
                <SelectTrigger id={`question-${question.id}-agent-limit`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="1">1 time</SelectItem>
                  <SelectItem value="2">2 times</SelectItem>
                  <SelectItem value="3">3 times</SelectItem>
                  <SelectItem value="5">5 times</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Controls how many times the same assigned agent can be selected per day for this field.
              </p>
            </div>
          ) : null}

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
      setPreviewValue(question.options && question.options.length > 0 ? "[]" : "false")
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
    if (question.question_type === "multiselect" || question.question_type === "checkbox") {
      try {
        const parsed = JSON.parse(previewValue || "[]")
        return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []
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

      {(question.question_type === "select" || question.question_type === "multiselect") &&
        question.option_source_kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND && (
        <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4 text-sm text-blue-900">
          {question.question_type === "multiselect"
            ? "Assigned agents will load dynamically as a checkbox list for the logged-in Sales Promoter when the report form is opened."
            : "Assigned agents will load dynamically for the logged-in Sales Promoter when the report form is opened."}
          {typeof question.max_logs_per_agent_per_day === "number"
            ? ` Each agent can be logged up to ${question.max_logs_per_agent_per_day} time${question.max_logs_per_agent_per_day === 1 ? "" : "s"} per day for this field.`
            : " Each agent can be logged any number of times per day for this field."}
        </div>
      )}

      {question.question_type === "select" &&
        question.option_source_kind !== ASSIGNED_AGENTS_OPTION_SOURCE_KIND &&
        question.options && (
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

      {question.question_type === "checkbox" &&
        (question.options && question.options.length > 0 ? (
          <div className="space-y-4">
            {question.options.map((option) => {
              const selectedValues = getMultiselectValue()
              const isChecked = selectedValues.includes(option)

              return (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`preview-checkbox-${option}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const current = getMultiselectValue()
                      const newValues = checked ? [...current, option] : current.filter((v) => v !== option)
                      handleChange(JSON.stringify(newValues))
                    }}
                  />
                  <Label htmlFor={`preview-checkbox-${option}`} className="cursor-pointer font-normal">
                    {option}
                  </Label>
                </div>
              )
            })}
          </div>
        ) : (
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
        ))}

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
