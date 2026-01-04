"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { 
  Plus, Pencil, Trash2, HelpCircle, Settings, Shield, Eye, Copy, Save, Sparkles, 
  RefreshCw, Search, Filter, Download, Upload, MoreVertical, ArrowUpDown, 
  ArrowUp, ArrowDown, CheckSquare, Square, X, BarChart3, FileText, 
  ChevronLeft, ChevronRight, GripVertical, LayoutGrid, List, ChevronDown, ChevronUp
} from "lucide-react"
import { QuestionTemplates, type QuestionTemplate } from "@/components/question-templates"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
}

interface RoleQuestion {
  id: string
  role_id: string
  question_key: string
  question_label: string
  question_title?: string | null
  question_type: string
  question_description: string | null
  placeholder: string | null
  options: string[] | null
  is_required: boolean
  display_order: number
  validation_rules: Record<string, any> | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Advanced features
  conditional_logic?: Record<string, any> | null
  default_value?: string | null
  help_text?: string | null
  min_value?: number | null
  max_value?: number | null
  min_length?: number | null
  max_length?: number | null
  pattern?: string | null
  step?: number | null
  min_date?: string | null
  max_date?: string | null
}

interface RoleQuestionWithRole extends RoleQuestion {
  role?: Role | null
}

type RoleQuestionsManagerProps = {
  externalSearchQuery?: string
  refreshKey?: number
}

export function RoleQuestionsManager({ externalSearchQuery, refreshKey }: RoleQuestionsManagerProps) {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth()
  const [questions, setQuestions] = useState<RoleQuestionWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<RoleQuestionWithRole | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<RoleQuestion | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState<RoleQuestionWithRole | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const { toast } = useToast()

  // Enhanced filtering and sorting state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortField, setSortField] = useState<"role" | "label" | "type" | "display_order" | "created_at">("display_order")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "grouped">("grouped")
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [dragState, setDragState] = useState<{ roleId: string; questionId: string } | null>(null)

  useEffect(() => {
    if (externalSearchQuery === undefined) return
    if (externalSearchQuery === searchQuery) return
    setSearchQuery(externalSearchQuery)
    setCurrentPage(1)
  }, [externalSearchQuery, searchQuery])

  // Cache tracking to prevent unnecessary refetches
  const dataLoadedRef = useRef(false)
  const lastFetchTimeRef = useRef<number>(0)
  const CACHE_DURATION = 30000 // 30 seconds - only refetch if data is older than this

  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin =
    currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const [formData, setFormData] = useState<Partial<RoleQuestion>>({
    role_id: "",
    question_key: "",
    question_label: "",
    question_title: "",
    question_type: "text",
    question_description: "",
    placeholder: "",
    options: null,
    is_required: false,
    display_order: 0,
    validation_rules: null,
    is_active: true,
    // Advanced features
    conditional_logic: null,
    default_value: null,
    help_text: null,
    min_value: null,
    max_value: null,
    min_length: null,
    max_length: null,
    pattern: null,
    step: null,
    min_date: null,
    max_date: null,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [optionInput, setOptionInput] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({})
  const [showTemplates, setShowTemplates] = useState(false)

  const [quickAddByRole, setQuickAddByRole] = useState<Record<string, string>>({})

  const toQuestionKey = useCallback((label: string) => {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  }, [])

  const openCreateDialogForRole = useCallback((roleId: string, displayOrder: number, presetLabel?: string) => {
    const label = presetLabel?.trim() || ""
    setFormData({
      role_id: roleId,
      question_key: label ? toQuestionKey(label) : "",
      question_label: label,
      question_title: "",
      question_type: "text",
      question_description: "",
      placeholder: "",
      options: null,
      is_required: false,
      display_order: displayOrder,
      validation_rules: null,
      is_active: true,
      conditional_logic: null,
      default_value: null,
      help_text: null,
      min_value: null,
      max_value: null,
      min_length: null,
      max_length: null,
      pattern: null,
      step: null,
      min_date: null,
      max_date: null,
    })
    setEditingQuestion(null)
    setFormErrors({})
    setShowCreateDialog(true)
  }, [toQuestionKey])

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      // Check if we should skip loading (data is fresh and not forced)
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTimeRef.current
      
      if (!forceRefresh && dataLoadedRef.current && timeSinceLastFetch < CACHE_DURATION) {
        return
      }

      setIsLoading(true)
      
      // First, verify we can access the database
      
      // Load roles using direct Supabase query
      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("*")
        .order("name", { ascending: true })
        .limit(1000)

      const roleDataWithDept: Role[] = ((roleData as unknown as Role[]) || []).map((r) => ({
        ...r,
        department_id: r.department_id ?? null,
      }))

      if (roleError) {
        const roleErrorObj: any = roleError
        let extractedError: Record<string, any> = {}

        extractedError.code = roleErrorObj?.code || roleErrorObj?.error_code || roleErrorObj?.statusCode
        extractedError.message = roleErrorObj?.message || roleErrorObj?.error_description || roleErrorObj?.error_msg
        extractedError.details = roleErrorObj?.details || roleErrorObj?.error_details
        extractedError.hint = roleErrorObj?.hint || roleErrorObj?.error_hint
        extractedError.name = roleErrorObj?.name

        if (roleErrorObj?.error) {
          extractedError.postgrest_error = roleErrorObj.error
          extractedError.code = extractedError.code || roleErrorObj.error.code
          extractedError.message = extractedError.message || roleErrorObj.error.message
          extractedError.details = extractedError.details || roleErrorObj.error.details
          extractedError.hint = extractedError.hint || roleErrorObj.error.hint
        }

        try {
          const ownProps = Object.getOwnPropertyNames(roleErrorObj)
          const ownPropValues: Record<string, any> = {}
          ownProps.forEach(prop => {
            try {
              ownPropValues[prop] = roleErrorObj[prop]
            } catch {
              ownPropValues[prop] = "[cannot access]"
            }
          })
          if (Object.keys(ownPropValues).length > 0) {
            extractedError.ownProperties = ownPropValues
          }
        } catch {}

        try {
          extractedError.jsonString = JSON.stringify(roleErrorObj, (key, value) => {
            if (key === "parent" || key === "original") return "[Circular]"
            return value
          }, 2)
        } catch (e: any) {
          extractedError.jsonStringError = e.message
        }

        extractedError.stringRepresentation = String(roleError)
        extractedError.toStringResult = roleError.toString?.()

        console.error("❌ Error loading roles:", extractedError)
      
        toast({
          title: "Error Loading Roles",
          description: extractedError.message || roleError.message || "Failed to load roles. Check console for details.",
          variant: "destructive",
        })
        // Don't throw - set empty array so UI can still render
        setRoles([])
      } else {
        setRoles(roleDataWithDept)
      }

      // Load questions using API route (ensures all questions are fetched, bypasses RLS issues)
      let questionData: RoleQuestionWithRole[] = []
      let questionError: unknown = null
      
      try {
        const apiUrl = '/api/role-questions'
        const questionsFromAPI = await apiFetch<RoleQuestionWithRole[]>(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        // Join with roles data - use existing role if present, otherwise find from loaded roles
        questionData = (Array.isArray(questionsFromAPI) ? questionsFromAPI : []).map((q) => ({
          ...q,
          role: q.role || roleDataWithDept.find((r) => r.id === q.role_id) || null,
        }))
      } catch (apiError: unknown) {
        console.error("❌ Error loading questions from API:", apiError)
        console.error("API Error Details:", {
          message: getErrorMessage(apiError, "Failed to load role questions"),
          stack: apiError instanceof Error ? apiError.stack : undefined,
          isAdmin,
          isSuperAdmin,
          currentUser: currentUser?.id,
          currentProfile: currentProfile?.role_id
        })
        questionError = apiError
        
        // Check if it's an authentication/authorization error
        const isAuthError = apiError instanceof ApiError
          ? apiError.status === 401
          : apiError instanceof Error
            ? apiError.message?.toLowerCase().includes('unauthorized') || apiError.message?.toLowerCase().includes('401')
            : false

        const isForbiddenError = apiError instanceof ApiError
          ? apiError.status === 403
          : apiError instanceof Error
            ? apiError.message?.toLowerCase().includes('forbidden') ||
              apiError.message?.toLowerCase().includes('403') ||
              apiError.message?.toLowerCase().includes('user profile not found')
            : false
        
        if (isAuthError) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to access the admin panel.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
        
        if (isForbiddenError) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access role questions. Admin privileges required.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
        
        // Fallback: Try direct Supabase query with explicit limit removal
        try {
          // Fetch all questions without limit (Supabase default is 1000, but we'll handle pagination if needed)
          const { data: questionsWithRoles, error: joinError } = await supabase
        .from("role_questions")
        .select(`
          *,
          role:roles(*)
        `)
        .order("display_order", { ascending: true })
            .limit(10000) // Set a high limit to ensure we get all questions

          if (joinError) {
            
            // Try without join
            const { data: questionsOnly, error: questionsOnlyError } = await supabase
              .from("role_questions")
              .select("*")
              .order("display_order", { ascending: true })
              .limit(10000)
            
            if (questionsOnlyError) {
              questionError = questionsOnlyError
            } else {
              questionData = (((questionsOnly as unknown as RoleQuestionWithRole[]) || [])).map((q) => ({
                ...q,
                role: roleDataWithDept.find((r) => r.id === q.role_id) || null,
              }))
            }
          } else {
            questionData = (((questionsWithRoles as unknown as RoleQuestionWithRole[]) || [])).map((q) => ({
              ...q,
              role: q.role || roleDataWithDept.find((r) => r.id === q.role_id) || null,
            }))
          }
        } catch (fallbackError: unknown) {
          console.error("❌ Fallback also failed:", fallbackError)
          questionError = fallbackError
        }
      }

      if (questionError && questionData.length === 0) {
        console.error("❌ Error loading questions:", questionError)
        console.error("Error details:", questionError)
        
        // Check if it's an RLS policy error
        const isRLSError =
          typeof questionError === "object" &&
          questionError !== null &&
          ((questionError as any).code === "42501" ||
            (typeof (questionError as any).message === "string" &&
              ((questionError as any).message.toLowerCase().includes("permission") ||
                (questionError as any).message.toLowerCase().includes("policy") ||
                (questionError as any).message.toLowerCase().includes("row-level security"))))
        
        if (isRLSError) {
          toast({
            title: "Access Denied - RLS Policy Issue",
            description: "Your role questions are blocked by Row Level Security policies. Please apply the migration '20251119000005_ensure_role_questions_rls_for_super_admin.sql' in Supabase SQL Editor.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error Loading Questions",
            description: getErrorMessage(questionError, "Failed to load questions. Check console for details."),
            variant: "destructive",
          })
        }
        // Don't throw - set empty array instead so UI can still render
        setQuestions([])
        return
      }
      
      setQuestions(questionData || [])
      
      // Mark data as loaded and update timestamp
      dataLoadedRef.current = true
      lastFetchTimeRef.current = Date.now()
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to load questions and roles",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentUser, currentProfile, isAdmin, isSuperAdmin, toast])

  useEffect(() => {
    // Only proceed if we have a user
    if (!currentUser) {
      return
    }

    // If profile is explicitly null (not loading), user is not admin
    if (currentProfile === null) {
      setIsLoading(false)
      return
    }

    // If profile is still loading (undefined), wait for it
    if (currentProfile === undefined) {
      return
    }

    // If user is admin, load data (only if not already loaded recently)
    if (isAdmin) {
      // Call loadData directly without including it in dependencies
      loadData(false).catch((error) => {
        console.error("Error loading data:", error)
      })
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentProfile?.role_id]) // Removed computed values to prevent unnecessary re-renders

  useEffect(() => {
    if (refreshKey === undefined) return
    if (!currentUser) return
    if (currentProfile === undefined) return
    if (currentProfile === null) return
    if (!isAdmin) return

    loadData(true).catch((error) => {
      console.error("Error loading data:", error)
    })
  }, [refreshKey, currentUser, currentProfile, isAdmin, loadData])

  // Enhanced filtering, sorting, and pagination
  const filteredAndSortedQuestions = useMemo(() => {
    let filtered = questions

    // Role filter
    if (selectedRole !== "all") {
      filtered = filtered.filter(q => q.role_id === selectedRole)
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(q =>
        q.question_label.toLowerCase().includes(query) ||
        q.question_key.toLowerCase().includes(query) ||
        q.question_description?.toLowerCase().includes(query) ||
        q.role?.name.toLowerCase().includes(query)
      )
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(q => q.question_type === filterType)
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(q => 
        filterStatus === "active" ? q.is_active : !q.is_active
      )
    }

    // Sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "role":
          comparison = (a.role?.name || "").localeCompare(b.role?.name || "")
          break
        case "label":
          comparison = a.question_label.localeCompare(b.question_label)
          break
        case "type":
          comparison = a.question_type.localeCompare(b.question_type)
          break
        case "display_order":
          comparison = (a.display_order || 0) - (b.display_order || 0)
          break
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [questions, selectedRole, searchQuery, filterType, filterStatus, sortField, sortDirection])

  // Group questions by role for grouped view
  const questionsByRole = useMemo(() => {
    const grouped: Record<string, RoleQuestionWithRole[]> = {}

    filteredAndSortedQuestions.forEach(question => {
      const roleId = question.role_id
      const roleName = question.role?.name || "Unknown Role"

      if (!grouped[roleId]) {
        grouped[roleId] = []
      }

      // Sort questions within each role by display_order
      grouped[roleId].push(question)
    })

    // Sort questions within each role by display_order
    Object.keys(grouped).forEach(roleId => {
      grouped[roleId].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    })

    // Build the list of roles to display in the grouped view.
    // Prefer the roles state when it has entries, but fall back to deriving
    // role definitions directly from the grouped questions so the UI works
    // even if the roles query is empty or restricted by RLS.
    let rolesForGrouping: Role[]

    if (roles && roles.length > 0) {
      // Use roles from state, filtered to only those that have questions
      rolesForGrouping = roles.filter(role => grouped[role.id] && grouped[role.id].length > 0)
    } else {
      // Derive roles from the questions themselves
      const derivedRoleMap = new Map<string, Role>()

      Object.entries(grouped).forEach(([roleId, roleQuestions]) => {
        // Use the first question in the group to infer the role name
        const sample = roleQuestions[0]
        const inferredName = sample.role?.name || "Unknown Role"

        if (!derivedRoleMap.has(roleId)) {
          derivedRoleMap.set(roleId, {
            id: roleId,
            name: inferredName,
            description: null,
            department_id: null,
          })
        }
      })

      rolesForGrouping = Array.from(derivedRoleMap.values())
    }

    // Sort roles by name
    const sortedRoles = rolesForGrouping.sort((a, b) => a.name.localeCompare(b.name))

    return { grouped, sortedRoles }
  }, [filteredAndSortedQuestions, roles])

  // Ensure consistent sorting for both views
  const sortedQuestionsForTable = useMemo(() => {
    return [...filteredAndSortedQuestions].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "role":
          comparison = (a.role?.name || "").localeCompare(b.role?.name || "")
          break
        case "label":
          comparison = a.question_label.localeCompare(b.question_label)
          break
        case "type":
          comparison = a.question_type.localeCompare(b.question_type)
          break
        case "display_order":
          comparison = (a.display_order || 0) - (b.display_order || 0)
          break
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredAndSortedQuestions, sortField, sortDirection])

  // Pagination
  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedQuestionsForTable.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedQuestionsForTable, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedQuestions.length / itemsPerPage)

  // Statistics
  const statistics = useMemo(() => {
    const total = questions.length
    const active = questions.filter(q => q.is_active).length
    const inactive = total - active
    const byRole = roles.reduce((acc, role) => {
      acc[role.id] = questions.filter(q => q.role_id === role.id).length
      return acc
    }, {} as Record<string, number>)
    const byType = questions.reduce((acc, q) => {
      acc[q.question_type] = (acc[q.question_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const required = questions.filter(q => q.is_required).length

    return {
      total,
      active,
      inactive,
      byRole,
      byType,
      required,
      optional: total - required
    }
  }, [questions, roles])

  // Helper function to build validation_rules from individual validation fields
  const buildValidationRules = (): Record<string, any> | null => {
    const rules: Record<string, any> = {}
    
    // Add validation fields if they are set
    if (formData.min_value !== null && formData.min_value !== undefined) {
      rules.min_value = formData.min_value
    }
    if (formData.max_value !== null && formData.max_value !== undefined) {
      rules.max_value = formData.max_value
    }
    if (formData.min_length !== null && formData.min_length !== undefined) {
      rules.min_length = formData.min_length
    }
    if (formData.max_length !== null && formData.max_length !== undefined) {
      rules.max_length = formData.max_length
    }
    if (formData.pattern) {
      rules.pattern = formData.pattern
    }
    if (formData.step !== null && formData.step !== undefined) {
      rules.step = formData.step
    }
    if (formData.min_date) {
      rules.min_date = formData.min_date
    }
    if (formData.max_date) {
      rules.max_date = formData.max_date
    }
    
    // Return null if no validation rules are set, otherwise return the rules object
    return Object.keys(rules).length > 0 ? rules : null
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.role_id) {
      errors.role_id = "Role is required"
    }
    if (!formData.question_key?.trim()) {
      errors.question_key = "Question key is required"
    } else if (!/^[a-z0-9-_]+$/.test(formData.question_key.trim())) {
      errors.question_key = "Question key must be lowercase alphanumeric with hyphens and underscores"
    }
    if (!formData.question_label?.trim()) {
      errors.question_label = "Question label is required"
    }
    if (!formData.question_type) {
      errors.question_type = "Question type is required"
    }
    if ((formData.question_type === "select" || 
         formData.question_type === "multiselect" || 
         formData.question_type === "radio" ||
         formData.question_type === "rating") && 
        (!formData.options || formData.options.length === 0)) {
      errors.options = "Options are required for this question type"
    }
    
    // Validation for rating scale
    if (formData.question_type === "rating") {
      if (!formData.options || formData.options.length === 0) {
        errors.options = "Rating scale requires numeric options (e.g., 1,2,3,4,5)"
      }
    }
    
    // Validation for number fields
    if (formData.question_type === "number") {
      if (formData.min_value != null && formData.max_value != null &&
          formData.min_value > formData.max_value) {
        errors.max_value = "Maximum value must be greater than minimum value"
      }
    }
    
    // Validation for text length
    if (formData.min_length != null && formData.max_length != null &&
        formData.min_length > formData.max_length) {
      errors.max_length = "Maximum length must be greater than minimum length"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    const isValid = validateForm()
    
    if (!isValid) {
      return
    }

    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to create questions.",
        variant: "destructive",
      })
      return
    }

    // Verify user has permission before attempting create
    if (!currentProfile) {
      toast({
        title: "Error",
        description: "Unable to verify your profile. Please try refreshing the page.",
        variant: "destructive",
      })
      return
    }
    
    // Check if profile is active
    if (currentProfile.is_active === false) {
      toast({
        title: "Error",
        description: "Your profile is inactive. Please contact an administrator to activate your account.",
        variant: "destructive",
      })
      return
    }
    
    // Verify user has admin or super admin role
    if (!isAdmin && !isSuperAdmin) {
      toast({
        title: "Error",
        description: "You do not have permission to create questions. Only admins and super admins can create questions.",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      // Check if question_key already exists for this role
      // Wrap in try-catch to handle timeout errors gracefully
      let existingQuestions: any[] = []
      try {
        const { data, error: checkError } = await supabase
          .from("role_questions")
          .select("id")
          .eq("role_id", formData.role_id!)
          .eq("question_key", formData.question_key!.trim())
          .limit(1)

        if (checkError) {
          // Check if it's a timeout error
          if (checkError.message?.includes('fetch failed') || 
              checkError.message?.includes('timeout') ||
              checkError.message?.includes('AbortError')) {
            console.warn('Timeout checking for existing questions, proceeding with caution...')
            // Continue without the check - database constraints will catch duplicates
          } else {
            throw checkError
          }
        }
        existingQuestions = data || []
      } catch (err: any) {
        // Handle network/timeout errors gracefully
        if (err.message?.includes('fetch failed') || 
            err.message?.includes('timeout') ||
            err.name === 'AbortError') {
          console.warn('Network timeout while checking for duplicates, proceeding...')
          // Continue - database unique constraint will catch duplicates
        } else {
          throw err
        }
      }

      if (existingQuestions && existingQuestions.length > 0) {
        throw new Error("A question with this key already exists for this role. Please use a different question key.")
      }

      // Get the next display_order for this role
      let nextDisplayOrder = 0
      try {
        const { data: lastQuestion, error: orderError } = await supabase
          .from("role_questions")
          .select("display_order")
          .eq("role_id", formData.role_id!)
          .order("display_order", { ascending: false })
          .limit(1)

        if (orderError) {
          // Check if it's a timeout error
          if (orderError.message?.includes('fetch failed') || 
              orderError.message?.includes('timeout') ||
              orderError.message?.includes('AbortError')) {
            console.warn('Timeout getting display order, using default value 0')
            // Use default display_order of 0
          } else {
            throw orderError
          }
        } else {
          nextDisplayOrder = lastQuestion && lastQuestion.length > 0 
            ? lastQuestion[0].display_order + 1 
            : 0
        }
      } catch (err: any) {
        // Handle network/timeout errors gracefully
        if (err.message?.includes('fetch failed') || 
            err.message?.includes('timeout') ||
            err.name === 'AbortError') {
          console.warn('Network timeout getting display order, using default 0')
          nextDisplayOrder = 0
        } else {
          throw err
        }
      }

      // Build validation_rules from individual validation fields
      const validationRules = buildValidationRules()

      // Build insert data - only include columns that exist in the schema
      // Valid columns: role_id, question_key, question_label, question_type, question_description,
      // placeholder, options, is_required, display_order, validation_rules, is_active,
      // created_by, updated_by, metadata
      // Note: Advanced fields like conditional_logic, default_value, help_text, etc. are not in schema
      // and could be stored in validation_rules or metadata JSONB fields if needed
      const insertData: any = {
        role_id: formData.role_id!,
        question_key: formData.question_key!.trim(),
        question_label: formData.question_label!.trim(),
        question_title: formData.question_title?.trim() || formData.question_label!.trim(),
        question_type: formData.question_type!,
        question_description: formData.question_description?.trim() || null,
        placeholder: formData.placeholder?.trim() || null,
        options: formData.options && formData.options.length > 0 ? formData.options : null,
        is_required: formData.is_required || false,
        display_order: nextDisplayOrder,
        validation_rules: validationRules,
        is_active: formData.is_active !== false,
        created_by: currentUser.id,
        updated_by: currentUser.id,
      };

      // Log the insert data for debugging
      console.log("Creating question with data:", {
        insertData,
        currentUser: currentUser?.id,
        currentProfile: currentProfile,
        isAdmin,
        isSuperAdmin,
        profileRoleId: currentProfile?.role_id,
        profileIsActive: currentProfile?.is_active,
        expectedAdminRoleId: ADMIN_ROLE_ID,
        expectedSystemAdminRoleId: SYSTEM_ADMIN_ROLE_ID,
        expectedSuperAdminRoleId: SUPER_ADMIN_ROLE_ID,
      })

      let { error } = await supabase.from("role_questions").insert(insertData);

      // Handle PGRST204 (missing column) errors by retrying without the problematic column
      if (error && (error as any)?.code === "PGRST204") {
        const errorMessage = (error as any)?.message || "";
        // Extract column name from error message: "Could not find the 'column_name' column..."
        const columnMatch = errorMessage.match(/['"]([^'"]+)['"]/);
        const missingColumn = columnMatch ? columnMatch[1] : null;
        
        if (missingColumn && insertData.hasOwnProperty(missingColumn)) {
          console.warn(`Column '${missingColumn}' not found in schema. Retrying insert without it.`);
          
          // Create a new insert object without the missing column
          const retryInsertData = { ...insertData };
          delete retryInsertData[missingColumn];
          
          // Retry the insert without the problematic column
          const retryResult = await supabase.from("role_questions").insert(retryInsertData);
          
          if (retryResult.error) {
            // If retry also fails, use the original error
            error = retryResult.error;
          } else {
            // Success on retry
            error = null;
            console.log(`Successfully created question after removing column '${missingColumn}'`);
          }
        }
      }

      if (error) {
        const errorObj = error as any;
        
        // Extract all possible error properties using multiple methods
        let extractedError: Record<string, any> = {};
        
        // Method 1: Direct property access
        extractedError.code = errorObj?.code || errorObj?.error_code || errorObj?.statusCode;
        extractedError.message = errorObj?.message || errorObj?.error_description || errorObj?.error_msg;
        extractedError.details = errorObj?.details || errorObj?.error_details;
        extractedError.hint = errorObj?.hint || errorObj?.error_hint;
        extractedError.name = errorObj?.name;
        
        // Method 2: Try to access PostgREST error structure
        if (errorObj?.error) {
          extractedError.postgrest_error = errorObj.error;
          extractedError.code = extractedError.code || errorObj.error.code;
          extractedError.message = extractedError.message || errorObj.error.message;
          extractedError.details = extractedError.details || errorObj.error.details;
          extractedError.hint = extractedError.hint || errorObj.error.hint;
        }
        
        // Method 3: Get all own property names
        try {
          const ownProps = Object.getOwnPropertyNames(errorObj);
          const ownPropValues: Record<string, any> = {};
          ownProps.forEach(prop => {
            try {
              ownPropValues[prop] = errorObj[prop];
            } catch (e) {
              ownPropValues[prop] = '[cannot access]';
            }
          });
          if (Object.keys(ownPropValues).length > 0) {
            extractedError.ownProperties = ownPropValues;
          }
        } catch (e) {
          // Ignore errors in property extraction
        }
        
        // Method 4: Try JSON stringification with replacer
        try {
          extractedError.jsonString = JSON.stringify(errorObj, (key, value) => {
            // Skip circular references
            if (key === 'parent' || key === 'original') return '[Circular]';
            return value;
          }, 2);
        } catch (e: any) {
          extractedError.jsonStringError = e.message;
        }
        
        // Convert error to string as fallback
        extractedError.stringRepresentation = String(error);
        extractedError.toStringResult = error.toString?.();
        
        const errorInfo = {
          ...extractedError,
          // Context information
          context: {
            formData,
            currentUser: currentUser?.id,
            userRole: currentProfile?.role_id,
            isAdmin,
            isSuperAdmin,
            timestamp: new Date().toISOString()
          }
        };
        
        console.error("Supabase create error:", errorInfo);
        console.error("Raw error object:", error);
        console.error("Error type:", typeof error);
        console.error("Error constructor:", error?.constructor?.name);
        
        // Check for specific error codes
        const errorCode = extractedError.code || errorObj?.code;
        if (errorCode === "23505") {
          throw new Error("A question with this key already exists for this role. Please use a different question key.")
        }
        
        // Check for missing column errors (should have been handled above, but just in case)
        if (errorCode === "PGRST204") {
          const errorMessage = extractedError.message || "";
          const columnMatch = errorMessage.match(/['"]([^'"]+)['"]/);
          const missingColumn = columnMatch ? columnMatch[1] : "unknown column";
          throw new Error(`Database schema mismatch: The column '${missingColumn}' doesn't exist in the role_questions table. Please run database migrations to add this column.`)
        }
        
        // Check for RLS/permission errors (42501 is PostgreSQL permission denied)
        if (errorCode === "42501" || 
            errorCode === "PGRST301" || 
            errorCode === "PGRST302" ||
            extractedError.message?.toLowerCase().includes("permission") || 
            extractedError.message?.toLowerCase().includes("policy") ||
            extractedError.message?.toLowerCase().includes("row-level security")) {
          
          // Try to verify the user's profile via RLS to diagnose the issue
          // IMPORTANT: Use select('*') first since specific column select might be blocked by RLS
          // Then extract the needed fields from the result
          const { data: profileCheckFull, error: profileCheckError } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle()
          
          const profileCheck = profileCheckFull ? {
            role_id: profileCheckFull.role_id,
            is_active: profileCheckFull.is_active,
            user_id: profileCheckFull.user_id
          } : null
          
          // Also try to test if the RLS policy check would pass by simulating it
          // This helps us understand if the issue is with the RLS policy itself
          console.log("🔍 Testing RLS policy check simulation:", {
            authUid: currentUser.id,
            profileFromContext: {
              user_id: currentProfile?.user_id || currentUser.id,
              role_id: currentProfile?.role_id,
              is_active: currentProfile?.is_active,
            },
            profileFromRLS: profileCheck,
            profileCheckError: profileCheckError,
            expectedCheck: `EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role_id = '${ADMIN_ROLE_ID}' OR role_id = '${SYSTEM_ADMIN_ROLE_ID}' OR role_id = '${SUPER_ADMIN_ROLE_ID}') AND is_active = true)`,
            wouldPass: profileCheck && 
              (profileCheck.role_id === ADMIN_ROLE_ID || profileCheck.role_id === SYSTEM_ADMIN_ROLE_ID || profileCheck.role_id === SUPER_ADMIN_ROLE_ID) &&
              profileCheck.is_active === true
          })
          
          console.error("RLS INSERT blocked - diagnostic info:", {
            errorCode,
            errorMessage: extractedError.message,
            currentUser: currentUser?.id,
            currentProfile: currentProfile,
            profileFromContext: {
              role_id: currentProfile?.role_id,
              is_active: currentProfile?.is_active,
            },
            profileFromRLS: profileCheck,
            profileCheckError: profileCheckError,
            isAdmin,
            isSuperAdmin,
            expectedAdminRoleId: ADMIN_ROLE_ID,
            expectedSuperAdminRoleId: SUPER_ADMIN_ROLE_ID,
            profileMatchesAdmin: currentProfile?.role_id === ADMIN_ROLE_ID,
            profileMatchesSuperAdmin: currentProfile?.role_id === SUPER_ADMIN_ROLE_ID,
            rlsPolicyCheck: {
              // What the RLS policy is checking
              checkUserProfile: "EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role_id = admin OR role_id = super_admin) AND is_active = true)",
              userCanSeeOwnProfile: profileCheck ? "Yes" : "No (RLS on user_profiles may be blocking)",
            }
          })
          
          // Provide helpful error message with instructions to fix RLS
          let rlsErrorMsg = "Permission denied: You don't have permission to create questions. "
          
          if (!currentProfile) {
            rlsErrorMsg += "Your profile was not found in context. Please refresh the page or contact an administrator."
          } else if (profileCheckError) {
            rlsErrorMsg += `Unable to verify your profile via RLS: ${profileCheckError.message}. This suggests the RLS policy on user_profiles table may be blocking the check.`
          } else if (!profileCheck) {
            rlsErrorMsg += "Your profile was not found in the database. Please contact an administrator."
          } else if (profileCheck.is_active === false) {
            rlsErrorMsg += "Your profile is inactive (is_active = false). Please contact an administrator to activate your account."
          } else if (profileCheck.role_id !== ADMIN_ROLE_ID && profileCheck.role_id !== SUPER_ADMIN_ROLE_ID) {
            rlsErrorMsg += `Your profile has role ID ${profileCheck.role_id}, but you need admin (${ADMIN_ROLE_ID}) or super admin (${SUPER_ADMIN_ROLE_ID}) role to create questions.`
          } else {
            rlsErrorMsg += `The RLS policy check is failing even though your profile looks correct (role_id: ${profileCheck.role_id}, is_active: ${profileCheck.is_active}). This might be a timing issue or the RLS policy on user_profiles is blocking the check. Please verify the user_profiles RLS policies allow reading your own profile.`
          }
          
          throw new Error(rlsErrorMsg)
        }
        
        // Extract error message
        const errorMessage = extractedError.message || 
                            extractedError.details || 
                            extractedError.hint ||
                            (typeof error === 'string' ? error : errorCode ? `Database error (${errorCode})` : "Unknown error");
        
        throw new Error(errorMessage || "Failed to create question. Please check console for details.")
      }

      toast({
        title: "Success",
        description: "Question created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
      loadData(true) // Force refresh after create
      setIsCreating(false)
    } catch (error: any) {
      const errorObj = error as any;
      
      // Check if it's a timeout/network error
      const isTimeoutError = errorObj?.message?.includes('fetch failed') || 
                             errorObj?.message?.includes('timeout') ||
                             errorObj?.message?.includes('AbortError') ||
                             errorObj?.name === 'AbortError'
      
      const errorDetails = {
        message: errorObj?.message || errorObj?.error_description || errorObj?.errorMessage,
        code: errorObj?.code || errorObj?.error_code || errorObj?.statusCode,
        details: errorObj?.details,
        hint: errorObj?.hint,
        isTimeout: isTimeoutError,
        stringified: (() => {
          try {
            return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
          } catch (e) {
            try {
              return JSON.stringify({
                message: errorObj?.message,
                code: errorObj?.code,
                details: errorObj?.details,
                hint: errorObj?.hint,
              }, null, 2);
            } catch {
              return String(error);
            }
          }
        })(),
      };
      
      console.error("Error creating question:", errorDetails);
      console.error("Raw error object:", error);
      
      let errorMessage: string;
      let errorTitle = "Error";
      
      if (isTimeoutError) {
        errorTitle = "Network Timeout";
        errorMessage = "The request timed out while connecting to the database. This could be due to slow network connectivity or database performance issues. Please try again in a moment. If the problem persists, contact your system administrator.";
      } else {
        errorMessage = errorObj?.message || 
                      errorObj?.details || 
                      errorObj?.hint ||
                      errorObj?.error_description ||
                      "Failed to create question";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingQuestion || !validateForm()) return

    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to update questions.",
        variant: "destructive",
      })
      return
    }

    // Use profile from context instead of querying again
    // Verify user has permission to update
    if (!currentProfile) {
      toast({
        title: "Error",
        description: "Unable to verify your profile. Please try refreshing the page.",
        variant: "destructive",
      })
      return
    }
    
    // Check if profile is active (if the field exists)
    if (currentProfile.is_active === false) {
      toast({
        title: "Error",
        description: "Your profile is inactive. Please contact an administrator to activate your account.",
        variant: "destructive",
      })
      return
    }
    
    // Verify user has admin or super admin role
    if (!isAdmin && !isSuperAdmin) {
      toast({
        title: "Error",
        description: "You do not have permission to update questions. Only admins and super admins can update questions.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      let displayOrder = formData.display_order || editingQuestion.display_order || 0
      let roleIdToUpdate: string | undefined = undefined

      // If super admin changed the role, we need to check for duplicate question_key in the new role
      if (isSuperAdmin && formData.role_id && formData.role_id !== editingQuestion.role_id) {
        const { data: existingQuestions, error: checkError } = await supabase
        .from("role_questions")
          .select("id")
          .eq("role_id", formData.role_id)
          .eq("question_key", formData.question_key!.trim())
          .neq("id", editingQuestion.id) // Exclude current question

        if (checkError) throw checkError

        if (existingQuestions && existingQuestions.length > 0) {
          throw new Error("A question with this key already exists for the selected role. Please use a different question key.")
        }

        // If role changed, we need to recalculate display_order for the new role
        const { data: lastQuestion, error: orderError } = await supabase
          .from("role_questions")
          .select("display_order")
          .eq("role_id", formData.role_id)
          .order("display_order", { ascending: false })
          .limit(1)

        if (orderError) throw orderError

        displayOrder = lastQuestion && lastQuestion.length > 0 
          ? lastQuestion[0].display_order + 1 
          : 0

        roleIdToUpdate = formData.role_id
      }

      // Build validation_rules from individual validation fields
      const validationRules = buildValidationRules()

      // Build update data - only include columns that exist in the schema
      // Valid columns: role_id, question_key, question_label, question_type, question_description,
      // placeholder, options, is_required, display_order, validation_rules, is_active,
      // created_by, updated_by, metadata
      // Note: Advanced fields like conditional_logic, default_value, help_text, etc. are not in schema
      // and could be stored in validation_rules or metadata JSONB fields if needed
      const updateData: any = {
          question_key: formData.question_key!.trim(),
          question_label: formData.question_label!.trim(),
          question_title: formData.question_title?.trim() || formData.question_label!.trim(),
          question_type: formData.question_type!,
          question_description: formData.question_description?.trim() || null,
          placeholder: formData.placeholder?.trim() || null,
          options: formData.options && formData.options.length > 0 ? formData.options : null,
          is_required: formData.is_required || false,
        display_order: displayOrder,
          validation_rules: validationRules,
          is_active: formData.is_active !== false,
        updated_by: currentUser.id,
      }

      // Only update role_id if super admin changed it
      if (roleIdToUpdate) {
        updateData.role_id = roleIdToUpdate
      }

      // Clean up updateData - remove undefined values and ensure proper types
      const cleanedUpdateData: any = {}
      Object.keys(updateData).forEach(key => {
        const value = updateData[key]
        // Only include defined values (null is allowed, undefined is not)
        if (value !== undefined) {
          // Convert empty strings to null for optional fields
          if (typeof value === 'string' && value.trim() === '' && 
              (key === 'question_description' || key === 'placeholder' || key === 'help_text' || 
               key === 'default_value' || key === 'pattern')) {
            cleanedUpdateData[key] = null
          } else {
            cleanedUpdateData[key] = value
          }
        }
      })

      // Log the update data for debugging
      console.log("Updating question with data:", {
        questionId: editingQuestion.id,
        originalUpdateData: updateData,
        cleanedUpdateData,
        formData,
        currentUser: currentUser?.id,
        currentProfile: currentProfile,
        isAdmin,
        isSuperAdmin,
        editingQuestion,
        // Verify what RLS will see
        expectedRoleIds: {
          admin: ADMIN_ROLE_ID,
          superAdmin: SUPER_ADMIN_ROLE_ID
        }
      })

      let { data, error } = await supabase
        .from("role_questions")
        .update(cleanedUpdateData)
        .eq("id", editingQuestion.id)
        .select()

      // Handle PGRST204 (missing column) errors by retrying without the problematic column
      if (error && (error as any)?.code === "PGRST204") {
        const errorMessage = (error as any)?.message || "";
        // Extract column name from error message: "Could not find the 'column_name' column..."
        const columnMatch = errorMessage.match(/['"]([^'"]+)['"]/);
        const missingColumn = columnMatch ? columnMatch[1] : null;
        
        if (missingColumn && cleanedUpdateData.hasOwnProperty(missingColumn)) {
          console.warn(`Column '${missingColumn}' not found in schema. Retrying update without it.`);
          
          // Create a new update object without the missing column
          const retryUpdateData = { ...cleanedUpdateData };
          delete retryUpdateData[missingColumn];
          
          // Retry the update without the problematic column
          const retryResult = await supabase
            .from("role_questions")
            .update(retryUpdateData)
            .eq("id", editingQuestion.id)
            .select();
          
          if (retryResult.error) {
            // If retry also fails, use the original error
            error = retryResult.error;
            data = retryResult.data;
          } else {
            // Success on retry
            error = null;
            data = retryResult.data;
            console.log(`Successfully updated question after removing column '${missingColumn}'`);
          }
        }
      }

      if (error) {
        // Properly extract error information (handles non-enumerable properties)
        const errorObj = error as any;
        
        // Extract all possible error properties using multiple methods
        let extractedError: Record<string, any> = {};
        
        // Method 1: Direct property access
        extractedError.code = errorObj?.code || errorObj?.error_code || errorObj?.statusCode;
        extractedError.message = errorObj?.message || errorObj?.error_description || errorObj?.error_msg;
        extractedError.details = errorObj?.details || errorObj?.error_details;
        extractedError.hint = errorObj?.hint || errorObj?.error_hint;
        extractedError.name = errorObj?.name;
        
        // Method 2: Try to access PostgREST error structure
        if (errorObj?.error) {
          extractedError.postgrest_error = errorObj.error;
          extractedError.code = extractedError.code || errorObj.error.code;
          extractedError.message = extractedError.message || errorObj.error.message;
          extractedError.details = extractedError.details || errorObj.error.details;
          extractedError.hint = extractedError.hint || errorObj.error.hint;
        }
        
        // Method 3: Get all own property names
        try {
          const ownProps = Object.getOwnPropertyNames(errorObj);
          const ownPropValues: Record<string, any> = {};
          ownProps.forEach(prop => {
            try {
              ownPropValues[prop] = errorObj[prop];
            } catch (e) {
              ownPropValues[prop] = '[cannot access]';
            }
          });
          if (Object.keys(ownPropValues).length > 0) {
            extractedError.ownProperties = ownPropValues;
          }
        } catch (e) {
          // Ignore errors in property extraction
        }
        
        // Method 4: Try JSON stringification with replacer
        try {
          extractedError.jsonString = JSON.stringify(errorObj, (key, value) => {
            // Skip circular references
            if (key === 'parent' || key === 'original') return '[Circular]';
            return value;
          }, 2);
        } catch (e: any) {
          extractedError.jsonStringError = e.message;
        }
        
        // Convert error to string as fallback
        extractedError.stringRepresentation = String(error);
        extractedError.toStringResult = error.toString?.();
        
        const errorInfo = {
          ...extractedError,
          // Context information
          context: {
            cleanedUpdateData,
            originalUpdateData: updateData,
            questionId: editingQuestion.id,
            currentUser: currentUser?.id,
            userRole: currentProfile?.role_id,
            isAdmin,
            isSuperAdmin,
            timestamp: new Date().toISOString()
          }
        }
        
        // Log comprehensive error information
        console.error("Supabase update error:", errorInfo)
        
        // Also log the raw error separately for inspection
        console.error("Raw error object:", error)
        console.error("Error type:", typeof error)
        console.error("Error constructor:", error?.constructor?.name)
        
        // Check for specific error codes
        const errorCode = extractedError.code || errorObj?.code;
        if (errorCode === "23505") {
          throw new Error("A question with this key already exists for this role")
        }
        
        // Check for missing column errors (should have been handled above, but just in case)
        if (errorCode === "PGRST204") {
          const errorMessage = extractedError.message || "";
          const columnMatch = errorMessage.match(/['"]([^'"]+)['"]/);
          const missingColumn = columnMatch ? columnMatch[1] : "unknown column";
          throw new Error(`Database schema mismatch: The column '${missingColumn}' doesn't exist in the role_questions table. Please run database migrations to add this column.`)
        }
        
        // Check for RLS/permission errors (42501 is PostgreSQL permission denied)
        if (errorCode === "42501" || 
            errorCode === "PGRST301" || 
            errorCode === "PGRST302" ||
            extractedError.message?.toLowerCase().includes("permission") || 
            extractedError.message?.toLowerCase().includes("policy") ||
            extractedError.message?.toLowerCase().includes("row-level security")) {
          throw new Error("Permission denied: You don't have permission to update this question. Please check your role permissions.")
        }
        
        // Extract error message from various possible properties
        const errorMessage = extractedError.message || 
                            extractedError.details || 
                            extractedError.hint ||
                            (typeof error === 'string' ? error : errorCode ? `Database error (${errorCode})` : "Unknown error")
        
        throw new Error(errorMessage || "Failed to update question. Please check console for details.")
      }

      // Check if update succeeded but SELECT returned empty (RLS on SELECT may block it)
      // When UPDATE succeeds but SELECT is blocked by RLS, we get: error = null, data = []
      // This is expected behavior - the UPDATE worked, we just can't see the result immediately via SELECT
      if (!error && (!data || data.length === 0)) {
        console.log("✅ Update succeeded (200 OK) but SELECT returned empty - RLS blocked SELECT. This is expected. Reloading data to show updated question...")
        // Treat as success - we'll reload the data below to get the updated question
      } else if (error) {
        // Error was already handled above, but this shouldn't execute
        throw error
      }

      toast({
        title: "Success",
        description: "Question updated successfully",
      })

      // After a successful update, close the dialog and clear edit state
      setShowCreateDialog(false)
      setEditingQuestion(null)
      resetForm()
      loadData(true) // Force refresh after update
    } catch (error: any) {
      // Extract comprehensive error information
      const errorObj = error as any;
      const errorDetails = {
        // Try all possible error properties
        message: errorObj?.message || errorObj?.error_description || errorObj?.errorMessage,
        code: errorObj?.code || errorObj?.error_code || errorObj?.statusCode,
        details: errorObj?.details,
        hint: errorObj?.hint,
        name: errorObj?.name,
        // Safe serialization
        stringified: (() => {
          try {
            return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
          } catch (e) {
            try {
              return JSON.stringify({
                message: errorObj?.message,
                code: errorObj?.code,
                details: errorObj?.details,
                hint: errorObj?.hint,
              }, null, 2);
            } catch {
              return String(error);
            }
          }
        })(),
      };
      
      console.error("Error updating question:", errorDetails);
      console.error("Raw error object:", error);
      
      // Extract error message from various possible sources
      const errorMessage = errorObj?.message || 
                          errorObj?.details || 
                          errorObj?.hint ||
                          errorObj?.error_description ||
                          (typeof error === 'string' ? error : "Failed to update question")
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!questionToDelete) return

    try {
      const { error } = await supabase
        .from("role_questions")
        .delete()
        .eq("id", questionToDelete.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Question deleted successfully",
      })

      setShowDeleteDialog(false)
      setQuestionToDelete(null)
      loadData(true) // Force refresh after delete
    } catch (error: any) {
      console.error("Error deleting question:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete question",
        variant: "destructive",
      })
    }
  }


  const resetForm = () => {
    setFormData({
      role_id: "",
      question_key: "",
      question_label: "",
      question_title: "",
      question_type: "text",
      question_description: "",
      placeholder: "",
      options: null,
      is_required: false,
      display_order: 0,
      validation_rules: null,
      is_active: true,
      // Advanced features
      conditional_logic: null,
      default_value: null,
      help_text: null,
      min_value: null,
      max_value: null,
      min_length: null,
      max_length: null,
      pattern: null,
      step: null,
      min_date: null,
      max_date: null,
    })
    setFormErrors({})
    setOptionInput("")
    setShowPreview(false)
    setPreviewAnswers({})
    setShowTemplates(false)
  }

  const applyTemplate = (template: QuestionTemplate) => {
    setFormData({
      ...formData,
      question_type: template.question_type,
      question_label: template.question_label,
      question_title: template.question_label,
      question_description: template.question_description || "",
      placeholder: template.placeholder || "",
      options: template.options || null,
      is_required: template.is_required,
      help_text: template.help_text || "",
      min_length: template.validation?.min_length || null,
      max_length: template.validation?.max_length || null,
      min_value: template.validation?.min_value || null,
      max_value: template.validation?.max_value || null,
      pattern: template.validation?.pattern || null,
    })
    if (template.options) {
      setOptionInput(template.options.join(", "))
    }
    setShowTemplates(false)
    toast({
      title: "Template Applied",
      description: `"${template.name}" template has been applied.`,
    })
  }

  const openEditDialog = async (question: RoleQuestionWithRole) => {
    // Ensure roles are loaded before opening dialog
    if (roles.length === 0) {
      console.log("⚠️ No roles loaded, fetching roles before opening edit dialog...")
      try {
        const { data: directRoleData, error: roleError } = await supabase
          .from("roles")
          .select("*")
          .order("name", { ascending: true })
          .limit(1000)
        if (roleError) {
          console.error("❌ Error loading roles for edit dialog:", roleError)
          setRoles([])
        } else {
          const directRoleDataWithDept = (directRoleData || []).map((r: any) => ({
            ...r,
            department_id: r.department_id ?? null,
          }))
          setRoles(directRoleDataWithDept)
          console.log("✅ Loaded roles via direct query for edit dialog:", directRoleDataWithDept.length)
        }
      } catch (error) {
        console.error("❌ Error loading roles for edit dialog:", error)
        setRoles([])
      }
    }

    // Extract validation rules from the validation_rules JSONB field
    const validationRules = question.validation_rules || {}

    setEditingQuestion(question)
    setFormData({
      role_id: question.role_id,
      question_key: question.question_key,
      question_label: question.question_label,
      question_title: (question as any).question_title || "",
      question_type: question.question_type,
      question_description: question.question_description || "",
      placeholder: question.placeholder || "",
      options: question.options || null,
      is_required: question.is_required,
      display_order: question.display_order,
      validation_rules: question.validation_rules,
      is_active: question.is_active,
      // Advanced features
      conditional_logic: question.conditional_logic || null,
      default_value: question.default_value || null,
      help_text: question.help_text || null,
      // Extract validation fields from validation_rules JSONB
      min_value: validationRules.min_value ?? null,
      max_value: validationRules.max_value ?? null,
      min_length: validationRules.min_length ?? null,
      max_length: validationRules.max_length ?? null,
      pattern: validationRules.pattern || null,
      step: validationRules.step ?? null,
      min_date: validationRules.min_date || null,
      max_date: validationRules.max_date || null,
    })
    setOptionInput(question.options?.join(", ") || "")
    setShowCreateDialog(true)
  }

  const openDeleteDialog = (question: RoleQuestion) => {
    setQuestionToDelete(question)
    setShowDeleteDialog(true)
  }

  const addOption = () => {
    if (!optionInput.trim()) return
    const options = formData.options || []
    if (!options.includes(optionInput.trim())) {
      setFormData({
        ...formData,
        options: [...options, optionInput.trim()],
      })
    }
    setOptionInput("")
  }

  const removeOption = (option: string) => {
    const options = formData.options || []
    setFormData({
      ...formData,
      options: options.filter(o => o !== option),
    })
  }

  // Bulk operations
  const toggleQuestionSelection = (questionId: string) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId)
    } else {
      newSelected.add(questionId)
    }
    setSelectedQuestions(newSelected)
    setShowBulkActions(newSelected.size > 0)
  }

  const toggleAllSelection = () => {
    if (selectedQuestions.size === paginatedQuestions.length) {
      setSelectedQuestions(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedQuestions(new Set(paginatedQuestions.map(q => q.id)))
      setShowBulkActions(true)
    }
  }

  const handleBulkActivate = async () => {
    if (selectedQuestions.size === 0) return
    try {
      const { error } = await supabase
        .from("role_questions")
        .update({ is_active: true })
        .in("id", Array.from(selectedQuestions))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedQuestions.size} question(s) activated`,
      })
      setSelectedQuestions(new Set())
      setShowBulkActions(false)
      loadData(true) // Force refresh after bulk activate
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to activate questions",
        variant: "destructive",
      })
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedQuestions.size === 0) return
    try {
      const { error } = await supabase
        .from("role_questions")
        .update({ is_active: false })
        .in("id", Array.from(selectedQuestions))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedQuestions.size} question(s) deactivated`,
      })
      setSelectedQuestions(new Set())
      setShowBulkActions(false)
      loadData(true) // Force refresh after bulk deactivate
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate questions",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return
    try {
      const { error } = await supabase
        .from("role_questions")
        .delete()
        .in("id", Array.from(selectedQuestions))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedQuestions.size} question(s) deleted`,
      })
      setSelectedQuestions(new Set())
      setShowBulkActions(false)
      loadData(true) // Force refresh after bulk delete
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete questions",
        variant: "destructive",
      })
    }
  }

  const handleExport = (format: "csv" | "json") => {
    const data = filteredAndSortedQuestions.map(q => ({
      role: q.role?.name || "Unknown",
      question_key: q.question_key,
      question_label: q.question_label,
      question_title: (q as any).question_title || "",
      question_type: q.question_type,
      is_required: q.is_required,
      is_active: q.is_active,
      display_order: q.display_order,
      created_at: q.created_at,
    }))

    if (format === "csv") {
      const headers = Object.keys(data[0] || {})
      const csv = [
        headers.join(","),
        ...data.map(row => headers.map(h => JSON.stringify(row[h as keyof typeof row] || "")).join(","))
      ].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `role-questions-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `role-questions-${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    toast({
      title: "Export Successful",
      description: `Exported ${data.length} questions as ${format.toUpperCase()}`,
    })
  }

  const handleReorderQuestion = async (
    roleId: string,
    questionId: string,
    direction: "up" | "down",
  ) => {
    if (!isSuperAdmin) {
      toast({
        title: "Insufficient Permissions",
        description: "Only super admins can manage question ordering.",
        variant: "destructive",
      })
      return
    }

    try {
      const roleQuestions = questions
        .filter(q => q.role_id === roleId)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

      const currentIndex = roleQuestions.findIndex(q => q.id === questionId)
      if (currentIndex === -1) return

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= roleQuestions.length) return

      const reordered = [...roleQuestions]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      const updatedForRole = reordered.map((q, index) => ({
        ...q,
        display_order: index,
      }))

      const updatedIds = new Set(updatedForRole.map(q => q.id))

      // Optimistic local update
      setQuestions(prev =>
        prev.map(q => {
          if (!updatedIds.has(q.id)) return q
          const updated = updatedForRole.find(u => u.id === q.id)
          return updated || q
        }),
      )

      // Persist to Supabase
      await Promise.all(
        updatedForRole.map((q) =>
          supabase
            .from("role_questions")
            .update({ display_order: q.display_order })
            .eq("id", q.id),
        ),
      )

      toast({
        title: "Order Updated",
        description: "Question order for this role has been updated.",
      })
    } catch (error: any) {
      console.error("❌ Error updating question order:", error)
      toast({
        title: "Error Updating Order",
        description: error?.message || "Failed to update question ordering.",
        variant: "destructive",
      })
      // Reload from source of truth
      loadData(true).catch((e) => console.error("Error reloading data after order failure:", e))
    }
  }

  const handleDragReorderQuestion = async (
    roleId: string,
    sourceQuestionId: string,
    targetQuestionId: string,
  ) => {
    if (!isSuperAdmin) return

    try {
      const roleQuestions = questions
        .filter(q => q.role_id === roleId)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

      const fromIndex = roleQuestions.findIndex(q => q.id === sourceQuestionId)
      const toIndex = roleQuestions.findIndex(q => q.id === targetQuestionId)

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

      const reordered = [...roleQuestions]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)

      const updatedForRole = reordered.map((q, index) => ({
        ...q,
        display_order: index,
      }))

      const updatedIds = new Set(updatedForRole.map(q => q.id))

      setQuestions(prev =>
        prev.map(q => {
          if (!updatedIds.has(q.id)) return q
          const updated = updatedForRole.find(u => u.id === q.id)
          return updated || q
        }),
      )

      await Promise.all(
        updatedForRole.map((q) =>
          supabase
            .from("role_questions")
            .update({ display_order: q.display_order })
            .eq("id", q.id),
        ),
      )
    } catch (error) {
      console.error("❌ Error during drag reorder:", error)
      loadData(true).catch((e) => console.error("Error reloading data after drag reorder failure:", e))
    } finally {
      setDragState(null)
    }
  }

  const handleDuplicate = async (question: RoleQuestion) => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to duplicate questions.",
        variant: "destructive",
      })
      return
    }

    try {
      // Generate a unique question key
      let uniqueKey = `${question.question_key}_copy`
      let counter = 1

      // Check if the key already exists and increment counter until we find a unique one
      while (true) {
        const { data: existingQuestions, error: checkError } = await supabase
          .from("role_questions")
          .select("id")
          .eq("role_id", question.role_id)
          .eq("question_key", uniqueKey)

        if (checkError) throw checkError

        if (!existingQuestions || existingQuestions.length === 0) {
          break // Unique key found
        }

        counter++
        uniqueKey = `${question.question_key}_copy${counter}`
      }

      const { data: lastQuestion, error: orderError } = await supabase
        .from("role_questions")
        .select("display_order")
        .eq("role_id", question.role_id)
        .order("display_order", { ascending: false })
        .limit(1)

      if (orderError) throw orderError

      const nextDisplayOrder = lastQuestion && lastQuestion.length > 0
        ? lastQuestion[0].display_order + 1
        : 0

      const { error } = await supabase.from("role_questions").insert({
        role_id: question.role_id,
        question_key: uniqueKey,
        question_label: `${question.question_label} (Copy)`,
        question_title: (question as any).question_title || question.question_label,
        question_type: question.question_type,
        question_description: question.question_description,
        placeholder: question.placeholder,
        options: question.options,
        is_required: question.is_required,
        display_order: nextDisplayOrder,
        validation_rules: question.validation_rules,
        is_active: false, // Start as inactive
        created_by: currentUser.id,
        updated_by: currentUser.id,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Question duplicated successfully",
      })
      loadData(true) // Force refresh after duplicate
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate question",
        variant: "destructive",
      })
    }
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-muted-foreground py-8">
        You don't have permission to manage role questions.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading questions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.active} active, {statistics.inactive} inactive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Questions</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.active}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Required Fields</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.required}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.optional} optional questions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles with Questions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(statistics.byRole).filter(id => statistics.byRole[id] > 0).length}</div>
            <p className="text-xs text-muted-foreground">
              Out of {roles.length} total roles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Role Questions</h2>
          <p className="text-muted-foreground">
            Create and manage custom questions for specific roles. Multiple questions can be created for each role. Users assigned to a role will see these questions when submitting reports.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "grouped" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Grouped by Role
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8"
            >
              <List className="h-4 w-4 mr-1" />
              Table View
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileText className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileText className="mr-2 h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/admin/role-questions/new">
            <Button variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Create Multiple Questions
            </Button>
          </Link>
        </div>
      </div>

      {/* Question Templates */}
      {showTemplates && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Question Templates</CardTitle>
                <CardDescription>
                  Choose from pre-built question templates to get started quickly
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <QuestionTemplates onSelectTemplate={applyTemplate} />
          </CardContent>
        </Card>
      )}

      {/* Advanced Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setSelectedRole("all")
                setFilterType("all")
                setFilterStatus("all")
                setCurrentPage(1)
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by label, key, description, or role..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(value) => {
                setSelectedRole(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                      {role.name} ({statistics.byRole[role.id] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
            <div>
              <Label>Type</Label>
              <Select value={filterType} onValueChange={(value) => {
                setFilterType(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.keys(statistics.byType).map(type => (
                    <SelectItem key={type} value={type}>
                      {type} ({statistics.byType[type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={(value) => {
                setFilterStatus(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active ({statistics.active})</SelectItem>
                  <SelectItem value="inactive">Inactive ({statistics.inactive})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {sortedQuestionsForTable.length} of {statistics.total} questions
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedQuestions.size} question{selectedQuestions.size !== 1 ? "s" : ""} selected
                </span>
                <Separator orientation="vertical" className="h-4" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkActivate}
                >
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                >
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedQuestions(new Set())
                  setShowBulkActions(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Mode: Grouped by Role */}
      {viewMode === "grouped" ? (
        <div className="space-y-4">
          {questionsByRole.sortedRoles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {filteredAndSortedQuestions.length === 0 && statistics.total === 0
                  ? "No questions found. Create your first question."
                  : "No questions match your filters. Try adjusting your search criteria."}
              </CardContent>
            </Card>
          ) : (
            questionsByRole.sortedRoles.map((role) => {
              const roleQuestions = questionsByRole.grouped[role.id] || []
              // If no roles are explicitly expanded/collapsed, show all expanded
              const isExpanded = expandedRoles.size === 0 || expandedRoles.has(role.id)
              
              return (
                <Card key={role.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer hover:opacity-80 transition-opacity duration-150 ease-in-out"
                        onClick={() => {
                          const newExpanded = new Set(expandedRoles)
                          if (newExpanded.has(role.id)) {
                            newExpanded.delete(role.id)
                          } else {
                            newExpanded.add(role.id)
                          }
                          setExpandedRoles(newExpanded)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                        )}
                        <div>
                          <CardTitle className="text-lg font-semibold">
                            {role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/-/g, ' ')}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {role.description || `${roleQuestions.length} question${roleQuestions.length !== 1 ? "s" : ""}`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {roleQuestions.length} question{roleQuestions.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {roleQuestions.filter(q => q.is_active).length} active
                        </Badge>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openCreateDialogForRole(role.id, roleQuestions.length)
                          }}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Question
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {roleQuestions.map((question, index) => (
                          <Card
                            key={question.id}
                            className="border-l-4 border-l-primary/20"
                            onDragOver={(e) => {
                              if (!isSuperAdmin) return
                              if (!dragState || dragState.roleId !== role.id) return
                              e.preventDefault()
                            }}
                            onDrop={(e) => {
                              if (!isSuperAdmin) return
                              if (!dragState || dragState.roleId !== role.id) return
                              e.preventDefault()
                              void handleDragReorderQuestion(role.id, dragState.questionId, question.id)
                            }}
                          >
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-4">
                                <div className="pt-0.5">
                                  <button
                                    type="button"
                                    draggable={isSuperAdmin}
                                    aria-label="Reorder question"
                                    onDragStart={() => {
                                      if (!isSuperAdmin) return
                                      setDragState({ roleId: role.id, questionId: question.id })
                                    }}
                                    onDragEnd={() => setDragState(null)}
                                    className={
                                      "inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary " +
                                      (!isSuperAdmin ? "opacity-40 cursor-not-allowed" : "cursor-grab active:cursor-grabbing")
                                    }
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      #{roleQuestions.indexOf(question) + 1}
                                    </Badge>
                                    <span className="font-semibold text-base">
                                      {question.question_label}
                                    </span>
                                    {question.is_required && (
                                      <Badge variant="destructive" className="text-xs">Required</Badge>
                                    )}
                                    {!question.is_active && (
                                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                      {question.question_title || question.question_label}
                                    </code>
                                    <Badge variant="secondary" className="text-xs">
                                      {question.question_type}
                                    </Badge>
                                  </div>
                                  {question.question_description && (
                                    <p className="text-sm text-muted-foreground">
                                      {question.question_description}
                                    </p>
                                  )}
                                  {question.options && question.options.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {question.options.slice(0, 5).map((opt, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {opt}
                                        </Badge>
                                      ))}
                                      {question.options.length > 5 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{question.options.length - 5} more
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {isSuperAdmin && (
                                    <div className="flex flex-col items-center mr-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={question.display_order === 0}
                                        onClick={() => handleReorderQuestion(role.id, question.id, "up")}
                                      >
                                        <ChevronUp className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={index === roleQuestions.length - 1}
                                        onClick={() => handleReorderQuestion(role.id, question.id, "down")}
                                      >
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setPreviewQuestion(question)
                                      setShowPreviewModal(true)
                                    }}
                                    title="Preview"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDuplicate(question)}
                                    title="Duplicate"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditDialog(question)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setPreviewQuestion(question)
                                        setShowPreviewModal(true)
                                      }}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDuplicate(question)}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        Duplicate
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => openDeleteDialog(question)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        <Card className="border-dashed bg-muted/20">
                          <CardContent className="py-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="flex-1">
                                <Input
                                  value={quickAddByRole[role.id] || ""}
                                  onChange={(e) =>
                                    setQuickAddByRole((prev) => ({
                                      ...prev,
                                      [role.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter") return
                                    e.preventDefault()
                                    const label = (quickAddByRole[role.id] || "").trim()
                                    if (!label) return
                                    openCreateDialogForRole(role.id, roleQuestions.length, label)
                                    setQuickAddByRole((prev) => ({ ...prev, [role.id]: "" }))
                                  }}
                                  placeholder="Type a new question and press Enter..."
                                />
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  const label = (quickAddByRole[role.id] || "").trim()
                                  if (!label) return
                                  openCreateDialogForRole(role.id, roleQuestions.length, label)
                                  setQuickAddByRole((prev) => ({ ...prev, [role.id]: "" }))
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Add
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      ) : (
        /* Enhanced Table with Sorting and Bulk Selection */
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedQuestions.size === paginatedQuestions.length && paginatedQuestions.length > 0}
                      onCheckedChange={toggleAllSelection}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort("role")}>
                    <div className="flex items-center">
                      Role
                      <SortIcon field="role" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort("label")}>
                    <div className="flex items-center">
                      Question Label
                      <SortIcon field="label" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort("type")}>
                    <div className="flex items-center">
                      Type
                      <SortIcon field="type" />
                    </div>
                  </TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort("display_order")}>
                    <div className="flex items-center">
                      Order
                      <SortIcon field="display_order" />
                    </div>
                  </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                {paginatedQuestions.length === 0 ? (
              <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {filteredAndSortedQuestions.length === 0 && statistics.total === 0
                        ? "No questions found. Create your first question."
                        : "No questions match your filters. Try adjusting your search criteria."}
                </TableCell>
              </TableRow>
            ) : (
                  paginatedQuestions.map((question) => (
                    <TableRow 
                      key={question.id}
                      className={`hover:bg-muted/50 transition-colors ${!question.is_active ? "opacity-70" : ""}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedQuestions.has(question.id)}
                          onCheckedChange={() => toggleQuestionSelection(question.id)}
                        />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{question.role?.name || "Unknown"}</Badge>
                    </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className={`font-medium ${!question.is_active ? "line-through" : ""}`}>{question.question_label}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {question.question_key}
                          </div>
                          {question.question_description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {question.question_description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{question.question_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {question.is_required ? (
                        <Badge variant="destructive">Required</Badge>
                      ) : (
                        <Badge variant="outline">Optional</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={question.is_active ? "default" : "secondary"}>
                        {question.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          {question.display_order}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                            onClick={() => {
                              setPreviewQuestion(question)
                              setShowPreviewModal(true)
                            }}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                            onClick={() => handleDuplicate(question)}
                            title="Duplicate"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(question)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setPreviewQuestion(question)
                                setShowPreviewModal(true)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(question)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(question)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
            )}
          </TableBody>
        </Table>
      </div>
        </CardContent>
      </Card>
      )}

      {/* Pagination - Only for Table View */}
      {viewMode === "table" && totalPages > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="itemsPerPage" className="text-sm">Items per page:</Label>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedQuestionsForTable.length)} of {sortedQuestionsForTable.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Create Question"}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion
                ? "Update question information"
                : "Create a new question for a role. Use 'Create Multiple Questions' to add several questions at once."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role_id">
                Role <span className="text-destructive">*</span>
                {editingQuestion && isSuperAdmin && (
                  <span className="text-xs text-muted-foreground ml-2">(Super Admin can change)</span>
                )}
              </Label>
              <Select
                value={formData.role_id || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, role_id: value })
                }
                disabled={!!editingQuestion && !isSuperAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder={roles.length === 0 ? "Loading roles..." : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    editingQuestion ? (
                      <SelectItem value={editingQuestion.role_id} disabled={!isSuperAdmin}>
                        <div className="flex items-center justify-between w-full">
                          <span>{editingQuestion.role?.name || editingQuestion.role_id || "Current role"}</span>
                        </div>
                      </SelectItem>
                    ) : (
                      <SelectItem value="__no_roles__" disabled>
                        {isLoading ? "Loading roles..." : "No roles available"}
                      </SelectItem>
                    )
                  ) : (
                    <>
                      {editingQuestion && !roles.some(role => role.id === editingQuestion.role_id) && (
                        <SelectItem value={editingQuestion.role_id} disabled={!isSuperAdmin}>
                          <div className="flex items-center justify-between w-full">
                            <span>{editingQuestion.role?.name || editingQuestion.role_id || "Current role"}</span>
                          </div>
                        </SelectItem>
                      )}
                      {roles.map((role) => {
                        const questionCount = questions.filter(q => q.role_id === role.id).length
                        const isAssignedRole = !!editingQuestion && role.id === editingQuestion.role_id

                        return (
                          <SelectItem 
                            key={role.id} 
                            value={role.id}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="flex items-center gap-2">
                                <span>{role.name}</span>
                                {isSuperAdmin && isAssignedRole && (
                                  <Badge variant="default" className="text-[10px] font-medium flex items-center gap-1">
                                    <CheckSquare className="h-3 w-3" />
                                    Assigned
                                  </Badge>
                                )}
                              </span>
                              {questionCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                  {questionCount} question{questionCount !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </>
                  )}
                </SelectContent>
              </Select>
              {formErrors.role_id && (
                <p className="text-sm text-destructive">{formErrors.role_id}</p>
              )}
              {editingQuestion && !isSuperAdmin && (
                <p className="text-xs text-muted-foreground">
                  Role cannot be changed after creation. Only Super Admins can change the role.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="question_key">
                Question Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="question_key"
                value={formData.question_key || ""}
                onChange={(e) =>
                  setFormData({ ...formData, question_key: e.target.value })
                }
                placeholder="e.g., daily_tasks"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase alphanumeric with hyphens and underscores only
              </p>
              {formErrors.question_key && (
                <p className="text-sm text-destructive">{formErrors.question_key}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="question_label">
                Question Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="question_label"
                value={formData.question_label || ""}
                onChange={(e) =>
                  setFormData({ ...formData, question_label: e.target.value })
                }
                placeholder="e.g., What tasks did you complete today?"
              />
              {formErrors.question_label && (
                <p className="text-sm text-destructive">{formErrors.question_label}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="question_title">
                Question Title
              </Label>
              <Input
                id="question_title"
                value={formData.question_title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, question_title: e.target.value })
                }
                placeholder="Short title shown in the wizard step (optional)"
              />
              <p className="text-xs text-muted-foreground">
                If provided, this title is used as the step name in the daily entry wizard. Leave blank to use the question label.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="question_type">
                Question Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.question_type || "text"}
                onValueChange={(value) =>
                  setFormData({ ...formData, question_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {/* Text Input Types */}
                  <SelectItem value="text">📝 Text Input (Short)</SelectItem>
                  <SelectItem value="textarea">📄 Textarea (Long Text)</SelectItem>
                  
                  {/* Validated Input Types */}
                  <SelectItem value="email">📧 Email Address</SelectItem>
                  <SelectItem value="url">🔗 URL/Website Link</SelectItem>
                  <SelectItem value="phone">📱 Phone Number</SelectItem>
                  
                  {/* Numeric Types */}
                  <SelectItem value="number">🔢 Number (Integer/Decimal)</SelectItem>
                  <SelectItem value="currency">💰 Currency/Money</SelectItem>
                  <SelectItem value="percentage">📊 Percentage</SelectItem>
                  
                  {/* Date and Time Types */}
                  <SelectItem value="date">📅 Date Picker</SelectItem>
                  <SelectItem value="time">🕐 Time Picker</SelectItem>
                  <SelectItem value="datetime">📅🕐 Date & Time</SelectItem>
                  <SelectItem value="daterange">📅➡️📅 Date Range</SelectItem>
                  <SelectItem value="duration">⏱️ Duration (Hours/Minutes)</SelectItem>
                  
                  {/* Selection Types */}
                  <SelectItem value="select">▼ Dropdown Select (Single)</SelectItem>
                  <SelectItem value="radio">◉ Radio Buttons (Single)</SelectItem>
                  <SelectItem value="multiselect">☑️ Multi-Select (Checkboxes)</SelectItem>
                  <SelectItem value="checkbox">✓ Checkbox (Yes/No)</SelectItem>
                  
                  {/* Rating and Scale Types */}
                  <SelectItem value="rating">⭐ Rating Scale (Stars)</SelectItem>
                  <SelectItem value="slider">━ Slider Scale</SelectItem>
                  <SelectItem value="nps">📈 NPS Score (0-10)</SelectItem>
                  
                  {/* File and Media Types */}
                  <SelectItem value="file">📎 File Upload (Documents)</SelectItem>
                  <SelectItem value="image">🖼️ Image Upload</SelectItem>
                  
                  {/* Special Business Types */}
                  <SelectItem value="priority">🎯 Priority Level</SelectItem>
                  <SelectItem value="status">🚦 Status Indicator</SelectItem>
                  <SelectItem value="tags">🏷️ Tags (Multiple)</SelectItem>
                  <SelectItem value="rich-text">✍️ Rich Text Editor</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.question_type && (
                <p className="text-sm text-destructive">{formErrors.question_type}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="question_description">Description</Label>
              <Textarea
                id="question_description"
                value={formData.question_description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, question_description: e.target.value })
                }
                placeholder="Additional context for the question"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="placeholder">Placeholder</Label>
              <Input
                id="placeholder"
                value={formData.placeholder || ""}
                onChange={(e) =>
                  setFormData({ ...formData, placeholder: e.target.value })
                }
                placeholder="Placeholder text"
              />
            </div>
            {/* Options for select, multiselect, radio, rating, priority, status, nps, tags */}
            {(formData.question_type === "select" || 
              formData.question_type === "multiselect" || 
              formData.question_type === "radio" ||
              formData.question_type === "rating" ||
              formData.question_type === "priority" ||
              formData.question_type === "status" ||
              formData.question_type === "tags") && (
              <div className="space-y-2">
                <Label>
                  Options 
                  {formData.question_type === "rating" && " (e.g., 1,2,3,4,5 or Poor,Fair,Good,Very Good,Excellent)"}
                  {formData.question_type === "priority" && " (e.g., Low, Medium, High, Critical)"}
                  {formData.question_type === "status" && " (e.g., Not Started, In Progress, Completed, Blocked)"}
                  {formData.question_type === "tags" && " (Multiple tags available for selection)"}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addOption()
                      }
                    }}
                    placeholder={
                      formData.question_type === "rating" 
                        ? "Enter rating option (e.g., 1 or Poor)" 
                        : formData.question_type === "priority"
                        ? "Enter priority level (e.g., High)"
                        : formData.question_type === "status"
                        ? "Enter status option (e.g., In Progress)"
                        : formData.question_type === "tags"
                        ? "Enter tag option (e.g., Bug, Feature)"
                        : "Enter option and press Enter"
                    }
                  />
                  <Button type="button" onClick={addOption}>
                    Add
                  </Button>
                </div>
                {formData.options && formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.options.map((option) => (
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
                {formErrors.options && (
                  <p className="text-sm text-destructive">{formErrors.options}</p>
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
                  <Label htmlFor="help_text" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Help Text
                  </Label>
                  <Textarea
                    id="help_text"
                    value={formData.help_text || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, help_text: e.target.value })
                    }
                    placeholder="Additional help text or instructions for users"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    This text will appear below the question to guide users
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default_value">Default Value</Label>
                  <Input
                    id="default_value"
                    value={formData.default_value || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, default_value: e.target.value })
                    }
                    placeholder="Default value for this question"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pre-filled value when the question is displayed
                  </p>
                </div>

            <div className="flex items-center space-x-2">
                  <Switch
                id="is_required"
                checked={formData.is_required || false}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_required: checked })
                }
              />
                  <Label htmlFor="is_required" className="cursor-pointer">
                    Required Field
                  </Label>
            </div>
                
            <div className="flex items-center space-x-2">
                  <Switch
                id="is_active"
                checked={formData.is_active !== false}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Active (visible to users)
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="validation" className="space-y-4 mt-4">
                {/* Text validation */}
                {(formData.question_type === "text" || 
                  formData.question_type === "textarea" || 
                  formData.question_type === "email" ||
                  formData.question_type === "url" ||
                  formData.question_type === "phone") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min_length">Minimum Length</Label>
                        <Input
                          id="min_length"
                          type="number"
                          min="0"
                          value={formData.min_length || ""}
                onChange={(e) =>
                            setFormData({ 
                              ...formData, 
                              min_length: e.target.value ? parseInt(e.target.value) : null 
                            })
                }
                          placeholder="Min characters"
              />
                        {formErrors.min_length && (
                          <p className="text-sm text-destructive">{formErrors.min_length}</p>
                        )}
            </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_length">Maximum Length</Label>
                        <Input
                          id="max_length"
                          type="number"
                          min="0"
                          value={formData.max_length || ""}
                          onChange={(e) =>
                            setFormData({ 
                              ...formData, 
                              max_length: e.target.value ? parseInt(e.target.value) : null 
                            })
                          }
                          placeholder="Max characters"
                        />
                        {formErrors.max_length && (
                          <p className="text-sm text-destructive">{formErrors.max_length}</p>
                        )}
          </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pattern">Pattern (Regex)</Label>
                      <Input
                        id="pattern"
                        value={formData.pattern || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, pattern: e.target.value })
                        }
                        placeholder="e.g., ^[A-Za-z]+$ (letters only)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Regular expression pattern for validation
                      </p>
                    </div>
                  </>
                )}

                {/* Number validation */}
                {(formData.question_type === "number" || 
                  formData.question_type === "currency" || 
                  formData.question_type === "percentage") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_value">Minimum Value</Label>
                      <Input
                        id="min_value"
                        type="number"
                        value={formData.min_value || ""}
                        onChange={(e) =>
                          setFormData({ 
                            ...formData, 
                            min_value: e.target.value ? parseFloat(e.target.value) : null 
                          })
                        }
                        placeholder={formData.question_type === "percentage" ? "0" : "Min value"}
                      />
                      {formErrors.min_value && (
                        <p className="text-sm text-destructive">{formErrors.min_value}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_value">Maximum Value</Label>
                      <Input
                        id="max_value"
                        type="number"
                        value={formData.max_value || ""}
                        onChange={(e) =>
                          setFormData({ 
                            ...formData, 
                            max_value: e.target.value ? parseFloat(e.target.value) : null 
                          })
                        }
                        placeholder={formData.question_type === "percentage" ? "100" : "Max value"}
                      />
                      {formErrors.max_value && (
                        <p className="text-sm text-destructive">{formErrors.max_value}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="step">Step</Label>
                      <Input
                        id="step"
                        type="number"
                        step="0.01"
                        value={formData.step || ""}
                        onChange={(e) =>
                          setFormData({ 
                            ...formData, 
                            step: e.target.value ? parseFloat(e.target.value) : null 
                          })
                        }
                        placeholder={formData.question_type === "percentage" ? "1" : "e.g., 0.1 for decimals, 1 for integers"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.question_type === "currency" && "Increment step (e.g., 0.01 for cents)"}
                        {formData.question_type === "percentage" && "Percentage increment (default: 1)"}
                        {formData.question_type === "number" && "Increment step for number input"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Slider/NPS validation */}
                {(formData.question_type === "slider" || formData.question_type === "nps") && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {formData.question_type === "nps" 
                        ? "NPS scores are automatically configured from 0-10 (Net Promoter Score standard)" 
                        : "Configure the min/max range for the slider"}
                    </p>
                    {formData.question_type === "slider" && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="min_value">Minimum</Label>
                          <Input
                            id="min_value"
                            type="number"
                            value={formData.min_value || "0"}
                            onChange={(e) =>
                              setFormData({ 
                                ...formData, 
                                min_value: e.target.value ? parseFloat(e.target.value) : 0 
                              })
                            }
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max_value">Maximum</Label>
                          <Input
                            id="max_value"
                            type="number"
                            value={formData.max_value || "100"}
                            onChange={(e) =>
                              setFormData({ 
                                ...formData, 
                                max_value: e.target.value ? parseFloat(e.target.value) : 100 
                              })
                            }
                            placeholder="100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="step">Step</Label>
                          <Input
                            id="step"
                            type="number"
                            value={formData.step || "1"}
                            onChange={(e) =>
                              setFormData({ 
                                ...formData, 
                                step: e.target.value ? parseFloat(e.target.value) : 1 
                              })
                            }
                            placeholder="1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Date validation */}
                {(formData.question_type === "date" || 
                  formData.question_type === "datetime" ||
                  formData.question_type === "daterange") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_date">Minimum Date</Label>
                      <Input
                        id="min_date"
                        type="date"
                        value={formData.min_date || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, min_date: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.question_type === "daterange" && "Start date cannot be before this"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_date">Maximum Date</Label>
                      <Input
                        id="max_date"
                        type="date"
                        value={formData.max_date || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, max_date: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.question_type === "daterange" && "End date cannot be after this"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Duration validation */}
                {formData.question_type === "duration" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Duration fields allow users to enter time periods (e.g., "2 hours 30 minutes" or "150 minutes")
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min_value">Minimum (minutes)</Label>
                        <Input
                          id="min_value"
                          type="number"
                          min="0"
                          value={formData.min_value || ""}
                          onChange={(e) =>
                            setFormData({ 
                              ...formData, 
                              min_value: e.target.value ? parseFloat(e.target.value) : null 
                            })
                          }
                          placeholder="Min duration in minutes"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_value">Maximum (minutes)</Label>
                        <Input
                          id="max_value"
                          type="number"
                          min="0"
                          value={formData.max_value || ""}
                          onChange={(e) =>
                            setFormData({ 
                              ...formData, 
                              max_value: e.target.value ? parseFloat(e.target.value) : null 
                            })
                          }
                          placeholder="Max duration in minutes"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Conditional Logic
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show this question only when certain conditions are met. Note: This requires other questions to exist first.
                    </p>
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Conditional logic will be evaluated based on answers to previous questions in the form.
                        For now, this question will always be shown. Full conditional logic UI coming soon.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Preview Section */}
          {showPreview && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Question Preview</h3>
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {formData.question_label || "Question Label"}
                    {formData.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {formData.question_description && (
                    <p className="text-xs text-muted-foreground">
                      {formData.question_description}
                    </p>
                  )}
                  
                  {/* Preview based on question type */}
                  {formData.question_type === "text" && (
                    <Input
                      placeholder={formData.placeholder || ""}
                      value={previewAnswers[formData.question_key || ""] || ""}
                      onChange={(e) => setPreviewAnswers({
                        ...previewAnswers,
                        [formData.question_key || ""]: e.target.value
                      })}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "textarea" && (
                    <Textarea
                      placeholder={formData.placeholder || ""}
                      rows={4}
                      value={previewAnswers[formData.question_key || ""] || ""}
                      onChange={(e) => setPreviewAnswers({
                        ...previewAnswers,
                        [formData.question_key || ""]: e.target.value
                      })}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "select" && formData.options && (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder={formData.placeholder || "Select an option"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {formData.question_type === "radio" && formData.options && (
                    <RadioGroup disabled>
                      {formData.options.map((opt) => (
                        <div key={opt} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`preview-${opt}`} />
                          <Label htmlFor={`preview-${opt}`} className="cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  
                  {formData.question_type === "multiselect" && formData.options && (
                    <div className="space-y-2">
                      {formData.options.map((opt) => (
                        <div key={opt} className="flex items-center space-x-2">
                          <Checkbox disabled />
                          <Label className="text-sm font-normal">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formData.question_type === "checkbox" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox disabled />
                      <Label className="text-sm font-normal">
                        {formData.placeholder || "Yes"}
                      </Label>
                    </div>
                  )}
                  
                  {formData.question_type === "number" && (
                    <Input
                      type="number"
                      placeholder={formData.placeholder || ""}
                      min={formData.min_value || undefined}
                      max={formData.max_value || undefined}
                      step={formData.step || undefined}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "date" && (
                    <Input
                      type="date"
                      min={formData.min_date || undefined}
                      max={formData.max_date || undefined}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "email" && (
                    <Input
                      type="email"
                      placeholder={formData.placeholder || "example@email.com"}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "url" && (
                    <Input
                      type="url"
                      placeholder={formData.placeholder || "https://example.com"}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "phone" && (
                    <Input
                      type="tel"
                      placeholder={formData.placeholder || "+1 (555) 123-4567"}
                      disabled
                    />
                  )}
                  
                  {formData.question_type === "time" && (
                    <Input type="time" disabled />
                  )}
                  
                  {formData.question_type === "datetime" && (
                    <Input type="datetime-local" disabled />
                  )}
                  
                  {formData.question_type === "rating" && formData.options && (
                    <div className="flex flex-wrap gap-2">
                      {formData.options.map((opt) => (
                        <Button key={opt} type="button" variant="outline" disabled>
                          {opt}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {formData.question_type === "file" && (
                    <Input type="file" disabled />
                  )}
                  
                  {formData.help_text && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formData.help_text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false)
                setShowPreview(false)
              }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                console.log("🔵 Create button clicked", { editingQuestion, isUpdating, isCreating })
                if (editingQuestion) {
                  handleUpdate()
                } else {
                  handleCreate()
                }
              }}
              disabled={isUpdating || isCreating}
              type="button"
            >
              {(isUpdating || isCreating) && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingQuestion 
                ? (isUpdating ? "Updating..." : "Update")
                : (isCreating ? "Creating..." : "Create")
              }
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
            <DialogDescription>
              Preview how this question will appear to users
            </DialogDescription>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    {previewQuestion.question_label}
                    {previewQuestion.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Badge variant="outline">{previewQuestion.role?.name || "Unknown"}</Badge>
                </div>
                {previewQuestion.question_description && (
                  <p className="text-sm text-muted-foreground">
                    {previewQuestion.question_description}
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Question Details</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="secondary" className="ml-2">{previewQuestion.question_type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key:</span>
                    <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">{previewQuestion.question_key}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={previewQuestion.is_active ? "default" : "secondary"} className="ml-2">
                      {previewQuestion.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Required:</span>
                    <Badge variant={previewQuestion.is_required ? "destructive" : "outline"} className="ml-2">
                      {previewQuestion.is_required ? "Yes" : "No"}
                    </Badge>
                  </div>
                  {previewQuestion.placeholder && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Placeholder:</span>
                      <span className="ml-2">{previewQuestion.placeholder}</span>
                    </div>
                  )}
                  {previewQuestion.options && previewQuestion.options.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Options:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {previewQuestion.options.map((opt, idx) => (
                          <Badge key={idx} variant="outline">{opt}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Close
            </Button>
            {previewQuestion && (
              <Button onClick={() => {
                setShowPreviewModal(false)
                openEditDialog(previewQuestion)
              }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Question
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question "{questionToDelete?.question_label}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


