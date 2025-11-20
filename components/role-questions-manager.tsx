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
  ChevronLeft, ChevronRight, GripVertical
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

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
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

export function RoleQuestionsManager() {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth()
  const [questions, setQuestions] = useState<RoleQuestionWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<RoleQuestion | null>(null)
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

  // Cache tracking to prevent unnecessary refetches
  const dataLoadedRef = useRef(false)
  const lastFetchTimeRef = useRef<number>(0)
  const CACHE_DURATION = 30000 // 30 seconds - only refetch if data is older than this

  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || isSuperAdmin

  const [formData, setFormData] = useState<Partial<RoleQuestion>>({
    role_id: "",
    question_key: "",
    question_label: "",
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

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      // Check if we should skip loading (data is fresh and not forced)
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTimeRef.current
      
      if (!forceRefresh && dataLoadedRef.current && timeSinceLastFetch < CACHE_DURATION) {
        console.log("⏭️ Skipping data load - cache is still fresh")
        return
      }

      setIsLoading(true)
      
      // First, verify we can access the database
      console.log("🔍 Starting data load...", forceRefresh ? "(forced)" : "")
      console.log("👤 User ID:", currentUser?.id)
      console.log("🔑 Profile Role ID:", currentProfile?.role_id)
      
      // Load roles - try API route first, then fallback to direct query
      console.log("📥 Loading roles...")
      let roleData: Role[] = []
      let roleError: any = null

      try {
        // Try API route first
        const rolesResponse = await fetch('/api/admin/roles')
        if (rolesResponse.ok) {
          const rolesResult = await rolesResponse.json()
          roleData = rolesResult.data || []
          console.log("✅ Loaded roles from API:", roleData.length)
        } else {
          throw new Error("API route failed")
        }
      } catch (apiError) {
        console.warn("⚠️ API route failed, trying direct query...", apiError)
        // Fallback to direct Supabase query
        const { data: directRoleData, error: directRoleError } = await supabase
        .from("roles")
        .select("*")
        .order("name", { ascending: true })
          .limit(1000)

        if (directRoleError) {
          roleError = directRoleError
        } else {
          roleData = directRoleData || []
          console.log("✅ Loaded roles from direct query:", roleData.length)
        }
      }

      if (roleError) {
        console.error("❌ Error loading roles:", roleError)
        console.error("Error details:", {
          message: roleError.message,
          code: roleError.code,
          details: roleError.details,
          hint: roleError.hint
        })
        toast({
          title: "Error Loading Roles",
          description: roleError.message || "Failed to load roles. Check console for details.",
          variant: "destructive",
        })
        // Don't throw - set empty array so UI can still render
        setRoles([])
      } else {
        setRoles(roleData)
        console.log("✅ Loaded roles:", roleData.length)
        if (roleData.length > 0) {
          console.log("📋 Roles:", roleData.map(r => `${r.name} (${r.id})`).join(", "))
        } else {
          console.warn("⚠️ No roles found in database")
        }
      }

      // Load questions using API route (ensures all questions are fetched, bypasses RLS issues)
      let questionData: any[] = []
      let questionError: any = null
      
      console.log("📥 Loading role questions via API...")
      console.log("🌐 Making fetch request to /api/role-questions")
      try {
        const apiUrl = '/api/role-questions'
        console.log("📡 Fetch URL:", apiUrl)
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        console.log("📥 API Response status:", response.status, response.statusText)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        }
        
        const questionsFromAPI = await response.json()
        console.log("✅ Successfully loaded questions from API:", questionsFromAPI?.length || 0)
        
        // Manually join with roles data we already loaded
        questionData = (questionsFromAPI || []).map((q: any) => ({
          ...q,
          role: roleData?.find((r: any) => r.id === q.role_id) || null
        }))
        
        console.log("📋 Questions with roles:", questionData)
      } catch (apiError: any) {
        console.error("❌ Error loading questions from API:", apiError)
        questionError = apiError
        
        // Fallback: Try direct Supabase query with explicit limit removal
        console.log("🔄 Trying fallback: direct Supabase query...")
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
            console.warn("⚠️ Fallback join also failed:", joinError)
            
            // Try without join
            const { data: questionsOnly, error: questionsOnlyError } = await supabase
              .from("role_questions")
              .select("*")
              .order("display_order", { ascending: true })
              .limit(10000)
            
            if (questionsOnlyError) {
              questionError = questionsOnlyError
            } else {
              console.log("✅ Fallback successful - loaded questions without join")
              questionData = (questionsOnly || []).map((q: any) => ({
                ...q,
                role: roleData?.find((r: any) => r.id === q.role_id) || null
              }))
            }
          } else {
            console.log("✅ Fallback successful - loaded questions with role join")
            questionData = questionsWithRoles || []
          }
        } catch (fallbackError: any) {
          console.error("❌ Fallback also failed:", fallbackError)
          questionError = fallbackError
        }
      }

      if (questionError && questionData.length === 0) {
        console.error("❌ Error loading questions:", questionError)
        console.error("Error details:", {
          message: questionError.message,
          code: questionError.code,
          details: questionError.details,
          hint: questionError.hint
        })
        
        // Check if it's an RLS policy error
        const isRLSError = questionError.code === '42501' || 
                          questionError.message?.toLowerCase().includes('permission') ||
                          questionError.message?.toLowerCase().includes('policy') ||
                          questionError.message?.toLowerCase().includes('row-level security')
        
        if (isRLSError) {
          toast({
            title: "Access Denied - RLS Policy Issue",
            description: "Your role questions are blocked by Row Level Security policies. Please apply the migration '20251119000005_ensure_role_questions_rls_for_super_admin.sql' in Supabase SQL Editor.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error Loading Questions",
            description: questionError.message || "Failed to load questions. Check console for details.",
            variant: "destructive",
          })
        }
        // Don't throw - set empty array instead so UI can still render
        setQuestions([])
        return
      }
      
      console.log("✅ Loaded questions:", questionData?.length || 0)
      console.log("📋 Questions data:", questionData)
      
      if (questionData && questionData.length === 0) {
        console.warn("⚠️ No questions found. Check if questions were created successfully.")
        console.log("💡 Debug info:", {
          isAdmin,
          isSuperAdmin,
          currentUser: currentUser?.id,
          currentProfile: currentProfile?.role_id,
          rolesLoaded: roleData?.length || 0
        })
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
    // Load data when component mounts and user is admin
    console.log("🔄 useEffect triggered", {
      currentUser: currentUser?.id,
      currentProfile: currentProfile?.role_id,
      isAdmin,
      isSuperAdmin,
      profileLoaded: currentProfile !== undefined
    })

    // Only proceed if we have a user
    if (!currentUser) {
      console.log("⏳ Waiting for user...")
      return
    }

    // If profile is explicitly null (not loading), user is not admin
    if (currentProfile === null) {
      console.warn("❌ Profile loaded but user is not an admin")
      setIsLoading(false)
      return
    }

    // If profile is still loading (undefined), wait for it
    if (currentProfile === undefined) {
      console.log("⏳ Waiting for profile to load...")
      return
    }

    // If user is admin, load data (only if not already loaded recently)
    if (isAdmin) {
      console.log("✅ Admin access confirmed, loading data...")
      loadData(false) // Don't force refresh on mount if cache is fresh
    } else {
      console.warn("❌ User is not an admin")
      setIsLoading(false)
    }
  }, [currentUser, currentProfile, isAdmin, isSuperAdmin, loadData])

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

  // Pagination
  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedQuestions.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedQuestions, currentPage, itemsPerPage])

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
      if (formData.min_value !== null && formData.max_value !== null && 
          formData.min_value > formData.max_value) {
        errors.max_value = "Maximum value must be greater than minimum value"
      }
    }
    
    // Validation for text length
    if (formData.min_length !== null && formData.max_length !== null && 
        formData.min_length > formData.max_length) {
      errors.max_length = "Maximum length must be greater than minimum length"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to create questions.",
        variant: "destructive",
      })
      return
    }

    try {

      // Check if question_key already exists for this role
      const { data: existingQuestions, error: checkError } = await supabase
        .from("role_questions")
        .select("id")
        .eq("role_id", formData.role_id)
        .eq("question_key", formData.question_key!.trim())

      if (checkError) throw checkError

      if (existingQuestions && existingQuestions.length > 0) {
        throw new Error("A question with this key already exists for this role. Please use a different question key.")
      }

      // Get the next display_order for this role
      const { data: lastQuestion, error: orderError } = await supabase
        .from("role_questions")
        .select("display_order")
        .eq("role_id", formData.role_id)
        .order("display_order", { ascending: false })
        .limit(1)

      if (orderError) throw orderError

      const nextDisplayOrder = lastQuestion && lastQuestion.length > 0 
        ? lastQuestion[0].display_order + 1 
        : 0

      const { error } = await supabase.from("role_questions").insert({
        role_id: formData.role_id!,
        question_key: formData.question_key!.trim(),
        question_label: formData.question_label!.trim(),
        question_type: formData.question_type!,
        question_description: formData.question_description?.trim() || null,
        placeholder: formData.placeholder?.trim() || null,
        options: formData.options && formData.options.length > 0 ? formData.options : null,
        is_required: formData.is_required || false,
        display_order: nextDisplayOrder,
        validation_rules: formData.validation_rules,
        is_active: formData.is_active !== false,
        // Advanced features - TODO: Uncomment after migration 20251118020000_enhance_questions_advanced_features.sql is applied
        // help_text: formData.help_text?.trim() || null,
        // default_value: formData.default_value?.trim() || null,
        // min_value: formData.min_value || null,
        // max_value: formData.max_value || null,
        // min_length: formData.min_length || null,
        // max_length: formData.max_length || null,
        // pattern: formData.pattern?.trim() || null,
        // step: formData.step || null,
        // min_date: formData.min_date || null,
        // max_date: formData.max_date || null,
        // conditional_logic: formData.conditional_logic || null,
        created_by: currentUser.id,
        updated_by: currentUser.id,
      })

      if (error) {
        if (error.code === "23505") {
          throw new Error("This role already has a question. Each role can only have one question.")
        }
        throw error
      }

      toast({
        title: "Success",
        description: "Question created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
      loadData(true) // Force refresh after create
    } catch (error: any) {
      console.error("Error creating question:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create question",
        variant: "destructive",
      })
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

      const updateData: any = {
          question_key: formData.question_key!.trim(),
          question_label: formData.question_label!.trim(),
          question_type: formData.question_type!,
          question_description: formData.question_description?.trim() || null,
          placeholder: formData.placeholder?.trim() || null,
          options: formData.options && formData.options.length > 0 ? formData.options : null,
          is_required: formData.is_required || false,
        display_order: displayOrder,
          validation_rules: formData.validation_rules,
          is_active: formData.is_active !== false,
        // Advanced features - TODO: Uncomment after migration 20251118020000_enhance_questions_advanced_features.sql is applied
        // help_text: formData.help_text?.trim() || null,
        // default_value: formData.default_value?.trim() || null,
        // min_value: formData.min_value || null,
        // max_value: formData.max_value || null,
        // min_length: formData.min_length || null,
        // max_length: formData.max_length || null,
        // pattern: formData.pattern?.trim() || null,
        // step: formData.step || null,
        // min_date: formData.min_date || null,
        // max_date: formData.max_date || null,
        // conditional_logic: formData.conditional_logic || null,
        updated_by: currentUser.id,
      }

      // Only update role_id if super admin changed it
      if (roleIdToUpdate) {
        updateData.role_id = roleIdToUpdate
      }

      const { error } = await supabase
        .from("role_questions")
        .update(updateData)
        .eq("id", editingQuestion.id)

      if (error) {
        if (error.code === "23505") {
          throw new Error("A question with this key already exists for this role")
        }
        throw error
      }

      toast({
        title: "Success",
        description: "Question updated successfully",
      })

      setEditingQuestion(null)
      resetForm()
      loadData(true) // Force refresh after update
    } catch (error: any) {
      console.error("Error updating question:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update question",
        variant: "destructive",
      })
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
  }

  const applyTemplate = (template: QuestionTemplate) => {
    setFormData({
      ...formData,
      question_type: template.question_type,
      question_label: template.question_label,
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

  const openEditDialog = async (question: RoleQuestion) => {
    // Ensure roles are loaded before opening dialog
    if (roles.length === 0) {
      console.log("⚠️ No roles loaded, fetching roles before opening edit dialog...")
      try {
        const rolesResponse = await fetch('/api/admin/roles')
        if (rolesResponse.ok) {
          const rolesResult = await rolesResponse.json()
          setRoles(rolesResult.data || [])
          console.log("✅ Loaded roles for edit dialog:", rolesResult.data?.length || 0)
        } else {
          // Fallback to direct query
          const { data: directRoleData } = await supabase
            .from("roles")
            .select("*")
            .order("name", { ascending: true })
            .limit(1000)
          if (directRoleData) {
            setRoles(directRoleData)
            console.log("✅ Loaded roles via direct query for edit dialog:", directRoleData.length)
          }
        }
      } catch (error) {
        console.error("❌ Error loading roles for edit dialog:", error)
      }
    }

    setEditingQuestion(question)
    setFormData({
      role_id: question.role_id,
      question_key: question.question_key,
      question_label: question.question_label,
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
      min_value: question.min_value || null,
      max_value: question.max_value || null,
      min_length: question.min_length || null,
      max_length: question.max_length || null,
      pattern: question.pattern || null,
      step: question.step || null,
      min_date: question.min_date || null,
      max_date: question.max_date || null,
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
        question_key: `${question.question_key}_copy`,
        question_label: `${question.question_label} (Copy)`,
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
        <Button
            variant="outline"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Link href="/admin/role-questions/new">
            <Button variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Create Multiple Questions
            </Button>
          </Link>
          <Button
            variant="outline"
          onClick={() => {
            resetForm()
            setEditingQuestion(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
            Add Single Question
        </Button>
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
              Showing {filteredAndSortedQuestions.length} of {statistics.total} questions
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
          <CardContent className="py-3">
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

      {/* Enhanced Table with Sorting and Bulk Selection */}
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
                      className="hover:bg-muted/50 transition-colors"
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
                          <div className="font-medium">{question.question_label}</div>
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

      {/* Pagination */}
      {totalPages > 1 && (
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
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedQuestions.length)} of {filteredAndSortedQuestions.length}
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
                    <SelectItem value="" disabled>
                      {isLoading ? "Loading roles..." : "No roles available"}
                    </SelectItem>
                  ) : (
                    roles.map((role) => {
                      const questionCount = questions.filter(q => q.role_id === role.id).length
                      return (
                        <SelectItem 
                          key={role.id} 
                          value={role.id}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{role.name}</span>
                            {questionCount > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {questionCount} question{questionCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
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
                <SelectContent>
                  <SelectItem value="text">Text Input</SelectItem>
                  <SelectItem value="textarea">Textarea (Long Text)</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="datetime">Date & Time</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="radio">Radio Buttons</SelectItem>
                  <SelectItem value="multiselect">Multi-Select (Checkboxes)</SelectItem>
                  <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
                  <SelectItem value="rating">Rating Scale</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
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
            {/* Options for select, multiselect, radio, rating */}
            {(formData.question_type === "select" || 
              formData.question_type === "multiselect" || 
              formData.question_type === "radio" ||
              formData.question_type === "rating") && (
              <div className="space-y-2">
                <Label>
                  Options 
                  {formData.question_type === "rating" && " (e.g., 1,2,3,4,5 or Poor,Fair,Good,Very Good,Excellent)"}
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
                    placeholder={formData.question_type === "rating" 
                      ? "Enter rating option (e.g., 1 or Poor)" 
                      : "Enter option and press Enter"}
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
                {formData.question_type === "number" && (
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
                        placeholder="Min value"
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
                        placeholder="Max value"
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
                        placeholder="e.g., 0.1 for decimals, 1 for integers"
                      />
                      <p className="text-xs text-muted-foreground">
                        Increment step for number input
                      </p>
                    </div>
                  </div>
                )}

                {/* Date validation */}
                {(formData.question_type === "date" || formData.question_type === "datetime") && (
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
                    <p className="text-xs text-muted-foreground mt-1">
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
            <Button onClick={editingQuestion ? handleUpdate : handleCreate}>
              {editingQuestion ? "Update" : "Create"}
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
                      <div className="flex flex-wrap gap-2 mt-1">
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


