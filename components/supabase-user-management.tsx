"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import {
  UserPlus,
  RefreshCw,
  Edit,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronLeft,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { UsersTableSkeleton } from "@/components/skeletons/users-table-skeleton"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { DepartmentAccessLevelManager } from "@/components/department-access-level-manager"
import useSWR, { useSWRConfig } from "swr"
import { PaginatedTable } from "@/components/ui/paginated-table"

// Role IDs from schema
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const USER_ROLE_ID = "00000000-0000-0000-0000-000000000002"
const SYSTEM_ADMIN_ROLE_NAME = "system-admin"
const DEPARTMENT_NONE = "__none__"
const DEPARTMENT_ROLE_NONE = "__none__"

interface UserWithProfile {
  id: string
  email: string
  created_at: string
  email_confirmed_at?: string | null
  profile: {
    id: string
    name: string
    department_id: string | null
    role_id: string
    role_name: string
    is_active: boolean
    created_at: string
    last_login: string | null
  } | null
}

type AdminUsersApiUser = {
  id: string
  email: string
  email_confirmed_at: string | null
  created_at: string
  profile: NonNullable<UserWithProfile["profile"]>
}

type AdminUsersResponse = {
  data: AdminUsersApiUser[]
  pagination?: {
    page: number
    perPage: number
    totalCount: number
    totalPages: number
  }
}

type AdminCreateUserResponse = {
  user: {
    id: string
    email: string | null
    created_at: string | null
  }
  profile: {
    id: string
    user_id: string
    name: string
    department_id: string | null
    role_id: string
    is_active: boolean
    created_at: string
    updated_at?: string
    last_login?: string | null
  }
}

interface Department {
  id: string
  name: string
  code: string | null
  is_active: boolean
}

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
  created_at: string
  updated_at: string
}

type DepartmentRoleRow = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
}

type UserAssignmentsMembershipRow = {
  id: string
  user_id: string
  department_id: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  department: {
    id: string
    name: string
    is_active: boolean
  } | null
}

type UserAssignmentsProfessionRow = {
  id: string
  user_id: string
  department_id: string
  role_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  department: {
    id: string
    name: string
    is_active: boolean
  } | null
  role: {
    id: string
    name: string
    description: string | null
    department_id: string | null
    level: number | null
  } | null
}

type UserAssignmentsResponse = {
  data: {
    user_id: string
    memberships: UserAssignmentsMembershipRow[]
    profession_assignments: UserAssignmentsProfessionRow[]
  }
}

export function SupabaseUserManagement() {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth()
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [userDepartmentsByUserId, setUserDepartmentsByUserId] = useState<Record<string, string[]>>({})
  const [roles, setRoles] = useState<Role[]>([])
  const [departmentRoles, setDepartmentRoles] = useState<DepartmentRoleRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [editUserPanelMode, setEditUserPanelMode] = useState<"edit" | "reset_password" | "delete">("edit")
  const [resetPasswordMode, setResetPasswordMode] = useState<"email" | "direct">("email")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const { mutate: globalMutate } = useSWRConfig()

  // Check if current user is admin
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID

  // Create user form state
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role_id: USER_ROLE_ID,
    department_id: null as string | null,
    department_role: DEPARTMENT_ROLE_NONE,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Edit user form state
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role_id: USER_ROLE_ID,
    department_id: null as string | null,
    department_role: DEPARTMENT_ROLE_NONE,
    is_active: true,
    email_verified: false,
    pendingAccessLevelId: null as string | null,
  })

  const lastUsersErrorRef = useRef<string | null>(null)
  const lastRolesErrorRef = useRef<string | null>(null)
  const lastDepartmentsErrorRef = useRef<string | null>(null)
  const lastMembershipsErrorRef = useRef<string | null>(null)
  const lastDepartmentRolesErrorRef = useRef<string | null>(null)
  const lastUserAssignmentsErrorRef = useRef<string | null>(null)
  const prefilledAssignmentsUserIdRef = useRef<string | null>(null)

  const usersKey = isAdmin ? "/api/admin/users?per_page=1000" : null
  const rolesKey = isAdmin ? "/api/admin/roles" : null
  const departmentsKey = isAdmin ? "/api/admin/departments" : null
  const membershipsKey = isAdmin ? "/api/admin/users/memberships" : null
  const departmentRolesKey = isAdmin ? "/api/admin/department-roles" : null
  const departmentProfessionRolesKey =
    isAdmin && (createUserForm.department_id || editUserForm.department_id)
      ? `/api/admin/departments/${createUserForm.department_id || editUserForm.department_id}/profession-roles`
      : null
  const userAssignmentsKey =
    isAdmin && showEditUser && editingUser?.id ? `/api/admin/users/${editingUser.id}/assignments` : null

  const {
    data: usersResponse,
    error: usersError,
    isLoading: isUsersLoading,
    isValidating: isUsersValidating,
    mutate: mutateUsers,
  } = useSWR<AdminUsersResponse>(usersKey)

  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
    mutate: mutateRoles,
  } = useSWR<{ data: Role[] }>(rolesKey)

  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
    mutate: mutateDepartments,
  } = useSWR<{ data: Department[] }>(departmentsKey)

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: isMembershipsLoading,
    mutate: mutateMemberships,
  } = useSWR<{ data: Record<string, string[]> }>(membershipsKey)

  const {
    data: departmentRolesResponse,
    error: departmentRolesError,
    isLoading: isDepartmentRolesLoading,
    mutate: mutateDepartmentRoles,
  } = useSWR<{ data: DepartmentRoleRow[] }>(departmentRolesKey)

  const {
    data: departmentProfessionRolesResponse,
    error: departmentProfessionRolesError,
    isLoading: isDepartmentProfessionRolesLoading,
  } = useSWR<{ data: DepartmentRoleRow[] }>(departmentProfessionRolesKey)

  const {
    data: userAssignmentsResponse,
    error: userAssignmentsError,
    isLoading: isUserAssignmentsLoading,
  } = useSWR<UserAssignmentsResponse>(userAssignmentsKey)

  const isLoading =
    isUsersLoading ||
    isRolesLoading ||
    isDepartmentsLoading ||
    isMembershipsLoading ||
    isDepartmentRolesLoading ||
    isDepartmentProfessionRolesLoading

  useEffect(() => {
    if (!usersError) {
      lastUsersErrorRef.current = null
      return
    }
    const message = getErrorMessage(usersError, "Failed to load users")
    if (lastUsersErrorRef.current !== message) {
      toast.error(message)
      lastUsersErrorRef.current = message
    }
  }, [usersError])

  useEffect(() => {
    if (!rolesError) {
      lastRolesErrorRef.current = null
      return
    }
    const message = getErrorMessage(rolesError, "Failed to load roles")
    if (lastRolesErrorRef.current !== message) {
      toast.error(message)
      lastRolesErrorRef.current = message
    }
  }, [rolesError])

  useEffect(() => {
    if (!departmentsError) {
      lastDepartmentsErrorRef.current = null
      return
    }
    const message = getErrorMessage(departmentsError, "Failed to load departments")
    if (lastDepartmentsErrorRef.current !== message) {
      toast.error(message)
      lastDepartmentsErrorRef.current = message
    }
  }, [departmentsError])

  useEffect(() => {
    if (!membershipsError) {
      lastMembershipsErrorRef.current = null
      return
    }
    const message = getErrorMessage(membershipsError, "Failed to load user department memberships")
    if (lastMembershipsErrorRef.current !== message) {
      toast.error(message)
      lastMembershipsErrorRef.current = message
    }
  }, [membershipsError])

  useEffect(() => {
    if (!departmentRolesError) {
      lastDepartmentRolesErrorRef.current = null
      return
    }
    const message = getErrorMessage(departmentRolesError, "Failed to load department roles")
    if (lastDepartmentRolesErrorRef.current !== message) {
      toast.error(message)
      lastDepartmentRolesErrorRef.current = message
    }
  }, [departmentRolesError])

  useEffect(() => {
    if (!departmentProfessionRolesError) {
      return
    }
    const message = getErrorMessage(departmentProfessionRolesError, "Failed to load department-specific roles")
    toast.error(message)
  }, [departmentProfessionRolesError])

  useEffect(() => {
    if (!userAssignmentsError) {
      lastUserAssignmentsErrorRef.current = null
      return
    }
    const message = getErrorMessage(userAssignmentsError, "Failed to load user assignments")
    if (lastUserAssignmentsErrorRef.current !== message) {
      toast.error(message)
      lastUserAssignmentsErrorRef.current = message
    }
  }, [userAssignmentsError])

  const mappedUsers = useMemo<UserWithProfile[]>(() => {
    const rows = Array.isArray(usersResponse?.data) ? usersResponse!.data : []
    return rows.map((user) => ({
      id: user.id,
      email: user.email || "N/A",
      email_confirmed_at: user.email_confirmed_at || null,
      created_at: user.created_at,
      profile: {
        id: user.profile.id,
        name: user.profile.name,
        department_id: user.profile.department_id,
        role_id: user.profile.role_id,
        role_name: user.profile.role_name || "user",
        is_active: user.profile.is_active,
        created_at: user.profile.created_at,
        last_login: user.profile.last_login,
      },
    }))
  }, [usersResponse])

  const activeDepartments = useMemo(() => {
    const list = departmentsResponse?.data || []
    return list.filter((d) => d.is_active)
  }, [departmentsResponse])

  const membershipsByUserId = useMemo(() => {
    return (membershipsResponse?.data || {}) as Record<string, string[]>
  }, [membershipsResponse])

  useEffect(() => {
    setUsers(mappedUsers)
  }, [mappedUsers])

  useEffect(() => {
    setDepartments(activeDepartments)
  }, [activeDepartments])

  useEffect(() => {
    setRoles(rolesResponse?.data || [])
  }, [rolesResponse])

  useEffect(() => {
    setDepartmentRoles(departmentRolesResponse?.data || [])
  }, [departmentRolesResponse])

  useEffect(() => {
    setUserDepartmentsByUserId(membershipsByUserId)
  }, [membershipsByUserId])

  useEffect(() => {
    if (!showEditUser || !editingUser?.id) {
      prefilledAssignmentsUserIdRef.current = null
      return
    }

    if (!userAssignmentsResponse?.data) return
    if (prefilledAssignmentsUserIdRef.current === editingUser.id) return

    const memberships = Array.isArray(userAssignmentsResponse.data.memberships)
      ? userAssignmentsResponse.data.memberships
      : []
    const professions = Array.isArray(userAssignmentsResponse.data.profession_assignments)
      ? userAssignmentsResponse.data.profession_assignments
      : []

    const activeMembership = memberships.find((m) => m.is_active) || null
    const activeProfession = professions.find((p) => p.is_active) || null

    const nextDepartmentId =
      activeMembership?.department_id || activeProfession?.department_id || editingUser.profile?.department_id || null
    const nextDepartmentRole = activeMembership?.role || DEPARTMENT_ROLE_NONE

    setEditUserForm((prev) => ({
      ...prev,
      department_id: nextDepartmentId,
      department_role: nextDepartmentRole,
    }))

    prefilledAssignmentsUserIdRef.current = editingUser.id
  }, [showEditUser, editingUser?.id, editingUser?.profile?.department_id, userAssignmentsResponse])

  useEffect(() => {
    if (!isAdmin) return
  }, [isAdmin])

  const getUserDepartmentNames = useCallback(
    (userId: string, profileDepartmentId?: string | null) => {
      const departmentNameById = (departmentId: string) => {
        return departments.find((d) => d.id === departmentId)?.name || departmentId
      }
      const fromMemberships = userDepartmentsByUserId[userId] || []
      const ids = profileDepartmentId ? Array.from(new Set([profileDepartmentId, ...fromMemberships])) : fromMemberships
      return ids.map(departmentNameById).filter(Boolean)
    },
    [userDepartmentsByUserId, departments]
  )

  const editSystemRoles = (() => {
    const order = ["admin", SYSTEM_ADMIN_ROLE_NAME, "user"]
    const allowed = new Set(order)

    const options = roles
      .filter((role) => allowed.has(role.name))
      .map((role) => ({ id: role.id, name: role.name }))
      .filter((opt, idx, all) => all.findIndex((x) => x.id === opt.id) === idx)

    if (!options.some((r) => r.id === USER_ROLE_ID)) {
      options.push({ id: USER_ROLE_ID, name: "user" })
    }

    if (!options.some((r) => r.id === ADMIN_ROLE_ID)) {
      options.push({ id: ADMIN_ROLE_ID, name: "admin" })
    }

    if (!options.some((r) => r.id === SYSTEM_ADMIN_ROLE_ID)) {
      options.push({ id: SYSTEM_ADMIN_ROLE_ID, name: SYSTEM_ADMIN_ROLE_NAME })
    }

    return options.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  })()

  const pageSize = 6

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const departmentNames = getUserDepartmentNames(user.id, user.profile?.department_id)
      const matchesSearch =
        user.profile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (departmentNames.length > 0 && departmentNames.join(" ").toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesRole = roleFilter === "all" || user.profile?.role_id === roleFilter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.profile?.is_active) ||
        (statusFilter === "inactive" && !user.profile?.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchTerm, roleFilter, statusFilter, getUserDepartmentNames])

  const departmentRoleOptions = useMemo(() => {
    // Use department-specific roles when a department is selected, otherwise fall back to global roles
    const selectedDepartmentId = createUserForm.department_id || editUserForm.department_id
    if (selectedDepartmentId && departmentProfessionRolesResponse?.data) {
      return departmentProfessionRolesResponse.data.filter((r) => r.is_active)
    }
    return (departmentRoles || []).filter((r) => r.is_active)
  }, [departmentRoles, departmentProfessionRolesResponse, createUserForm.department_id, editUserForm.department_id])

  const validateCreateUserForm = () => {
    const errors: Record<string, string> = {}

    if (!createUserForm.name.trim()) {
      errors.name = "Name is required"
    }

    if (!createUserForm.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserForm.email)) {
      errors.email = "Invalid email format"
    } else if (users.some((u) => u.email.toLowerCase() === createUserForm.email.toLowerCase())) {
      errors.email = "User with this email already exists"
    }

    if (!createUserForm.password) {
      errors.password = "Password is required"
    } else if (createUserForm.password.length < 8) {
      errors.password = "Password must be at least 8 characters"
    }

    if (!createUserForm.confirmPassword) {
      errors.confirmPassword = "Please confirm your password"
    } else if (createUserForm.password !== createUserForm.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    if (!createUserForm.role_id) {
      errors.role_id = "Role is required"
    }

    if (createUserForm.department_id && createUserForm.department_role === DEPARTMENT_ROLE_NONE) {
      errors.department_role = "Department role is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async () => {
    if (!validateCreateUserForm()) return

    const prevUsersResponse = usersResponse
    const nowIso = new Date().toISOString()
    const tempId = `temp-${Date.now()}`
    const roleName = roles.find((r) => r.id === createUserForm.role_id)?.name || "user"
    const nextDepartmentId = createUserForm.department_id
    const nextDepartmentRole = createUserForm.department_role

    let createdUserId: string | null = null

    const optimisticUser: AdminUsersApiUser = {
      id: tempId,
      email: createUserForm.email.trim().toLowerCase(),
      email_confirmed_at: nowIso,
      created_at: nowIso,
      profile: {
        id: tempId,
        name: createUserForm.name.trim(),
        department_id: nextDepartmentId,
        role_id: createUserForm.role_id,
        role_name: roleName,
        is_active: true,
        created_at: nowIso,
        last_login: null,
      },
    }

    mutateUsers(
      (current) => {
        if (!current) return { data: [optimisticUser] }
        const next = [optimisticUser, ...(Array.isArray(current.data) ? current.data : [])]
        return { ...current, data: next }
      },
      { revalidate: false }
    )

    try {
      // Create user via API endpoint (uses admin client server-side)
      const created = await apiFetch<AdminCreateUserResponse>("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: createUserForm.email,
          password: createUserForm.password,
          name: createUserForm.name.trim(),
          role_id: createUserForm.role_id,
          department_id: nextDepartmentId,
        }),
      })

      createdUserId = created.user.id

      const createdRoleName = roles.find((r) => r.id === created.profile.role_id)?.name || roleName
      const createdUser: AdminUsersApiUser = {
        id: created.user.id,
        email: created.user.email || optimisticUser.email,
        email_confirmed_at: nowIso,
        created_at: created.user.created_at || nowIso,
        profile: {
          id: created.profile.id,
          name: created.profile.name,
          department_id: created.profile.department_id,
          role_id: created.profile.role_id,
          role_name: createdRoleName,
          is_active: created.profile.is_active,
          created_at: created.profile.created_at,
          last_login: created.profile.last_login || null,
        },
      }

      mutateUsers(
        (current) => {
          if (!current) return { data: [createdUser] }
          const rows = Array.isArray(current.data) ? current.data : []
          const replaced = rows.map((u) => (u.id === tempId ? createdUser : u))
          const withoutTemp = replaced.filter((u) => u.id !== tempId)
          const hasReal = withoutTemp.some((u) => u.id === createdUser.id)
          const next = hasReal ? withoutTemp : [createdUser, ...withoutTemp]
          return { ...current, data: next }
        },
        { revalidate: false }
      )

      if (nextDepartmentId) {
        try {
          if (!nextDepartmentRole || nextDepartmentRole === DEPARTMENT_ROLE_NONE) {
            throw new Error("Department role is required")
          }

          await apiFetch(`/api/admin/departments/${nextDepartmentId}/memberships`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: createdUserId,
              role: nextDepartmentRole,
              is_active: true,
            }),
          })
        } catch (assignmentError: unknown) {
          console.error("Failed to save new user assignments:", assignmentError)
          toast.error(getErrorMessage(assignmentError, "User created but failed to save assignments"))
        }
      }

      // Reset form
      setCreateUserForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role_id: USER_ROLE_ID,
        department_id: null,
        department_role: DEPARTMENT_ROLE_NONE,
      })
      setFormErrors({})
      setShowPassword(false)
      setShowConfirmPassword(false)
      setShowCreateUser(false)

      toast.success("User created successfully")
      mutateUsers()
      mutateMemberships()
    } catch (error: unknown) {
      if (!createdUserId) {
        if (prevUsersResponse) {
          mutateUsers(prevUsersResponse, { revalidate: false })
        } else {
          mutateUsers()
        }
      } else {
        mutateUsers()
      }
      console.error("Failed to create user:", error)
      toast.error(getErrorMessage(error, "Failed to create user"))
    }
  }

  const validateEditUserForm = () => {
    const errors: Record<string, string> = {}

    if (!editUserForm.name.trim()) {
      errors.name = "Name is required"
    }

    if (!editUserForm.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUserForm.email)) {
      errors.email = "Invalid email format"
    } else if (
      users.some((u) => u.id !== editingUser?.id && u.email.toLowerCase() === editUserForm.email.toLowerCase())
    ) {
      errors.email = "Email is already in use by another user"
    }

    if (!editUserForm.role_id) {
      errors.role_id = "Role is required"
    }

    if (editUserForm.department_id && editUserForm.department_role === DEPARTMENT_ROLE_NONE) {
      errors.department_role = "Department role is required"
    }

    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpdateUser = async () => {
    if (!editingUser || !editingUser.profile) return

    if (!validateEditUserForm()) return

    setIsUpdatingUser(true)

    const nextName = editUserForm.name.trim()
    const nextEmail = editUserForm.email.trim().toLowerCase()
    const nextRoleId = editUserForm.role_id
    const nextRoleName = roles.find((r) => r.id === nextRoleId)?.name || "user"
    const nextIsActive = editUserForm.is_active
    const nextDepartmentId = editUserForm.department_id
    const nextDepartmentRole = editUserForm.department_role

    mutateUsers(
      (current) => {
        if (!current) return current
        const rows = Array.isArray(current.data) ? current.data : []
        const nextRows = rows.map((u) => {
          if (u.id !== editingUser.id) return u
          return {
            ...u,
            email: nextEmail,
            profile: {
              ...u.profile,
              name: nextName,
              role_id: nextRoleId,
              role_name: nextRoleName,
              department_id: nextDepartmentId,
              is_active: nextIsActive,
            },
          }
        })
        return { ...current, data: nextRows }
      },
      { revalidate: false }
    )

    try {
      // Check if we need to mark email as verified or unverified
      const shouldMarkEmailVerified = editUserForm.email_verified && !editingUser.email_confirmed_at
      const shouldUnmarkEmailVerified = !editUserForm.email_verified && !!editingUser.email_confirmed_at

      // Update user details
      await apiFetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: editingUser.id,
          name: editUserForm.name.trim(),
          email: editUserForm.email.trim().toLowerCase(),
          role_id: editUserForm.role_id,
          department_id: nextDepartmentId,
          is_active: editUserForm.is_active,
        }),
      })

      const memberships = Array.isArray(userAssignmentsResponse?.data?.memberships)
        ? userAssignmentsResponse!.data.memberships
        : []

      const prevActiveMembership = memberships.find((m) => m.is_active) || null
      const prevActiveMembershipDeptId = prevActiveMembership?.department_id || null

      if (!nextDepartmentId) {
        if (prevActiveMembershipDeptId) {
          await apiFetch(`/api/admin/departments/${prevActiveMembershipDeptId}/memberships/${editingUser.id}`, {
            method: "DELETE",
          })
        }
      } else {
        if (!nextDepartmentRole || nextDepartmentRole === DEPARTMENT_ROLE_NONE) {
          throw new Error("Department role is required")
        }

        await apiFetch(`/api/admin/departments/${nextDepartmentId}/memberships`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            role: nextDepartmentRole,
            is_active: true,
          }),
        })
      }

      toast.success("User updated successfully")

      // Mark email as verified if requested
      if (shouldMarkEmailVerified) {
        try {
          await apiFetch("/api/admin/users/mark-email-verified", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: editingUser.id,
            }),
          })

          mutateUsers(
            (current) => {
              if (!current) return current
              const rows = Array.isArray(current.data) ? current.data : []
              const nextRows = rows.map((u) =>
                u.id === editingUser.id ? { ...u, email_confirmed_at: new Date().toISOString() } : u
              )
              return { ...current, data: nextRows }
            },
            { revalidate: false }
          )

          // Update the editingUser state to reflect the new email verification status
          if (editingUser) {
            setEditingUser({
              ...editingUser,
              email_confirmed_at: new Date().toISOString(),
            })
          }

          toast.success(`Email for ${editUserForm.name || editUserForm.email} marked as verified`)
        } catch (verifyError: unknown) {
          console.error("Failed to mark email as verified:", verifyError)
          toast.error(getErrorMessage(verifyError, "Failed to mark email as verified"))
        }
      }

      // Unmark email as verified if requested
      if (shouldUnmarkEmailVerified) {
        try {
          await apiFetch("/api/admin/users/unmark-email-verified", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: editingUser.id,
            }),
          })

          mutateUsers(
            (current) => {
              if (!current) return current
              const rows = Array.isArray(current.data) ? current.data : []
              const nextRows = rows.map((u) => (u.id === editingUser.id ? { ...u, email_confirmed_at: null } : u))
              return { ...current, data: nextRows }
            },
            { revalidate: false }
          )

          // Update the editingUser state to reflect the new email verification status
          if (editingUser) {
            setEditingUser({
              ...editingUser,
              email_confirmed_at: null,
            })
          }

          toast.success(`Email for ${editUserForm.name || editUserForm.email} unmarked as verified`)
        } catch (unverifyError: unknown) {
          console.error("Failed to unmark email as verified:", unverifyError)
          toast.error(getErrorMessage(unverifyError, "Failed to unmark email as verified"))
        }
      }

      // Apply staged access level change if any
      if (editUserForm.pendingAccessLevelId !== undefined && editUserForm.department_id) {
        try {
          if (editUserForm.pendingAccessLevelId === null) {
            // Remove existing access level
            type Assignment = { id: string; department_id: string }
            const currentAssignmentsResponse = await apiFetch<{ data: Assignment[] }>(
              `/api/admin/users/${editingUser.id}/department-access-levels`
            )
            const existing = currentAssignmentsResponse.data?.find(
              (a: Assignment) => a.department_id === editUserForm.department_id
            )
            if (existing?.id) {
              await apiFetch(
                `/api/admin/users/${editingUser.id}/department-access-levels?assignmentId=${existing.id}`,
                {
                  method: "DELETE",
                }
              )
            }
          } else {
            // Assign or update access level
            await apiFetch(`/api/admin/users/${editingUser.id}/department-access-levels`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                department_id: editUserForm.department_id,
                access_level_id: editUserForm.pendingAccessLevelId,
              }),
            })
          }
        } catch (accessError: unknown) {
          console.error("Failed to apply access level change:", accessError)
          toast.error(getErrorMessage(accessError, "Failed to update access level"))
        }
      }

      setShowEditUser(false)
      setEditingUser(null)
      setEditFormErrors({})
      setEditUserForm((prev) => ({ ...prev, pendingAccessLevelId: null }))
      mutateUsers()
      mutateMemberships()
      if (userAssignmentsKey) {
        void globalMutate(userAssignmentsKey)
      }
    } catch (error: unknown) {
      mutateUsers()
      mutateMemberships()
      if (userAssignmentsKey) {
        void globalMutate(userAssignmentsKey)
      }
      console.error("Failed to update user:", error)
      toast.error(getErrorMessage(error, "Failed to update user"))
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleDeleteUser = async (user: UserWithProfile) => {
    if (!user) return

    if (user.id === currentUser?.id) {
      toast.error("You cannot delete your own account")
      return
    }

    const prevUsersResponse = usersResponse

    try {
      setIsDeletingUser(true)
      mutateUsers(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current.data) ? current.data : []
          return { ...current, data: rows.filter((u) => u.id !== user.id) }
        },
        { revalidate: false }
      )

      // Call the API to delete the user
      await apiFetch(`/api/admin/users?user_id=${user.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      toast.success("User deleted successfully")
      setShowEditUser(false)
      setEditingUser(null)
      setEditFormErrors({})
      setEditUserPanelMode("edit")
      setDeleteConfirmation("")
      mutateUsers()
      mutateMemberships()
    } catch (error: unknown) {
      if (prevUsersResponse) {
        mutateUsers(prevUsersResponse, { revalidate: false })
      } else {
        mutateUsers()
      }
      console.error("Failed to delete user:", error)
      toast.error(getErrorMessage(error, "Failed to delete user"))
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleResetPassword = async (user: UserWithProfile) => {
    if (!user) return

    setResettingPassword(true)

    try {
      if (resetPasswordMode === "email") {
        // Send password reset email
        await apiFetch("/api/admin/users/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            mode: "email",
          }),
        })

        toast.success(`Password reset email sent to ${user.email}`)
      } else {
        // Set new password directly
        if (!newPassword) {
          toast.error("Password is required")
          setResettingPassword(false)
          return
        }

        if (newPassword.length < 8) {
          toast.error("Password must be at least 8 characters")
          setResettingPassword(false)
          return
        }

        if (newPassword !== confirmNewPassword) {
          toast.error("Passwords do not match")
          setResettingPassword(false)
          return
        }

        await apiFetch("/api/admin/users/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            mode: "direct",
            password: newPassword,
          }),
        })

        toast.success("Password reset successfully")
        setNewPassword("")
        setConfirmNewPassword("")
      }

      setResetPasswordMode("email")
      setEditUserPanelMode("edit")
    } catch (error: unknown) {
      console.error("Failed to reset password:", error)
      toast.error(getErrorMessage(error, "Failed to reset password"))
    } finally {
      setResettingPassword(false)
    }
  }

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "admin":
        return "destructive"
      case "system-admin":
        return "default"
      case "user":
        return "secondary"
      default:
        return "outline"
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You need admin privileges to access user management.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <UsersTableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex pb-4 sm:justify-end">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              Promise.all([
                mutateUsers(),
                mutateRoles(),
                mutateDepartments(),
                mutateMemberships(),
                mutateDepartmentRoles(),
              ])
            }
            variant="outline"
            size="sm"
            disabled={isUsersValidating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUsersValidating ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateUser(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.length > 0 ? (
              roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))
            ) : (
              <>
                <SelectItem value={ADMIN_ROLE_ID}>Admin</SelectItem>
                <SelectItem value={SYSTEM_ADMIN_ROLE_ID}>System Admin</SelectItem>
                <SelectItem value={USER_ROLE_ID}>User</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <PaginatedTable
        data={filteredUsers}
        isLoading={isLoading}
        emptyMessage="No users found"
        pageSize={pageSize}
        searchPlaceholder="Search users..."
        searchKeys={["email"]}
        columns={[
          {
            key: "user",
            header: "User",
            cell: (user) => (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.profile?.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{user.profile?.name || "N/A"}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user.email || user.email === "N/A") return
                      try {
                        await navigator.clipboard.writeText(user.email)
                        toast.success("Email copied to clipboard")
                      } catch (error) {
                        console.error("Failed to copy email", error)
                        toast.error("Failed to copy email")
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    {user.email}
                  </button>
                </div>
              </div>
            ),
          },
          {
            key: "department",
            header: "Department",
            cell: (user) => {
              const names = getUserDepartmentNames(user.id, user.profile?.department_id)
              if (names.length === 0) return "-"
              return names.join(", ")
            },
          },
          {
            key: "role",
            header: "Role",
            cell: (user) => (
              <Badge variant={getRoleBadgeVariant(user.profile?.role_name || "user")}>
                {user.profile?.role_name || "user"}
              </Badge>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (user) => (
              <div className="flex items-center gap-2">
                {user.profile?.is_active ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{user.profile?.is_active ? "Active" : "Inactive"}</span>
              </div>
            ),
          },
          {
            key: "last_login",
            header: "Last Login",
            cell: (user) => (
              <div className="text-sm">
                {user.profile?.last_login ? new Date(user.profile.last_login).toLocaleDateString() : "Never"}
              </div>
            ),
          },
          {
            key: "created_at",
            header: "Created",
            cell: (user) => <div className="text-sm">{new Date(user.created_at).toLocaleDateString()}</div>,
          },
          {
            key: "actions",
            header: "Actions",
            cell: (user) => (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingUser(user)
                    setEditUserPanelMode("edit")
                    setResetPasswordMode("email")
                    setNewPassword("")
                    setConfirmNewPassword("")
                    setDeleteConfirmation("")
                    prefilledAssignmentsUserIdRef.current = null
                    setEditUserForm({
                      name: user.profile?.name || "",
                      email: user.email,
                      role_id: user.profile?.role_id || USER_ROLE_ID,
                      department_id: user.profile?.department_id || null,
                      department_role: DEPARTMENT_ROLE_NONE,
                      is_active: user.profile?.is_active ?? true,
                      email_verified: !!user.email_confirmed_at,
                      pendingAccessLevelId: null,
                    })
                    setShowEditUser(true)
                  }}
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit user</span>
                </Button>
              </div>
            ),
          },
        ]}
      />

      {/* Create User Dialog */}
      <RightSidePanel
        open={showCreateUser}
        onOpenChange={(open) => {
          setShowCreateUser(open)
          if (!open) {
            setFormErrors({})
            setShowPassword(false)
            setShowConfirmPassword(false)
            setCreateUserForm({
              name: "",
              email: "",
              password: "",
              confirmPassword: "",
              role_id: USER_ROLE_ID,
              department_id: null,
              department_role: DEPARTMENT_ROLE_NONE,
            })
          }
        }}
        title="Create New User"
        description="Add a new user to the system. They will receive an email to confirm their account."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form">
              Create User
            </Button>
          </div>
        }
      >
        <form
          id="create-user-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateUser()
          }}
        >
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={createUserForm.name}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
              />
              {formErrors.name && <p className="text-destructive text-sm">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email"
              />
              {formErrors.email && <p className="text-destructive text-sm">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password (min 8 characters)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {formErrors.password && <p className="text-destructive text-sm">{formErrors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={createUserForm.confirmPassword}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-8 w-8 p-0"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {formErrors.confirmPassword && <p className="text-destructive text-sm">{formErrors.confirmPassword}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={createUserForm.role_id}
                onValueChange={(value) => {
                  setCreateUserForm((prev) => ({
                    ...prev,
                    role_id: value,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {editSystemRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{role.name.replace(/-/g, " ")}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role_id && <p className="text-destructive text-sm">{formErrors.role_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-department">Department</Label>
              <Select
                value={createUserForm.department_id || DEPARTMENT_NONE}
                onValueChange={(value) => {
                  const nextDepartmentId = value === DEPARTMENT_NONE ? null : value
                  setCreateUserForm((prev) => ({
                    ...prev,
                    department_id: nextDepartmentId,
                    department_role: DEPARTMENT_ROLE_NONE,
                  }))
                }}
              >
                <SelectTrigger id="create-department">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEPARTMENT_NONE}>No department</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-department-role">Department role</Label>
              <Select
                value={createUserForm.department_role || DEPARTMENT_ROLE_NONE}
                onValueChange={(value) => setCreateUserForm((prev) => ({ ...prev, department_role: value }))}
                disabled={!createUserForm.department_id || isDepartmentProfessionRolesLoading}
              >
                <SelectTrigger id="create-department-role">
                  <SelectValue
                    placeholder={isDepartmentProfessionRolesLoading ? "Loading roles..." : "Select a department role"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEPARTMENT_ROLE_NONE}>None</SelectItem>
                  {departmentRoleOptions.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.department_role && <p className="text-destructive text-sm">{formErrors.department_role}</p>}
            </div>
          </div>
        </form>
      </RightSidePanel>

      {/* Edit User Dialog */}
      <RightSidePanel
        open={showEditUser}
        onOpenChange={(open) => {
          setShowEditUser(open)
          if (!open) {
            setEditingUser(null)
            setEditFormErrors({})
            setEditUserPanelMode("edit")
            setResetPasswordMode("email")
            setNewPassword("")
            setConfirmNewPassword("")
            setDeleteConfirmation("")
            setEditUserForm((prev) => ({ ...prev, pendingAccessLevelId: null }))
            prefilledAssignmentsUserIdRef.current = null
          }
        }}
        title={
          editUserPanelMode === "edit" ? (
            "Edit user"
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditUserPanelMode("edit")
                  setResetPasswordMode("email")
                  setNewPassword("")
                  setConfirmNewPassword("")
                  setDeleteConfirmation("")
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <span>{editUserPanelMode === "reset_password" ? "Reset password" : "Delete user"}</span>
            </div>
          )
        }
        description={
          !editingUser
            ? "Update user information and settings."
            : editUserPanelMode === "edit"
              ? `${editingUser.profile?.name || ""}${editingUser.profile?.name ? " • " : ""}${editingUser.email}`
              : `${editingUser.profile?.name || editingUser.email}`
        }
        footer={
          editUserPanelMode === "edit" ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditUser(false)
                  setEditingUser(null)
                  setEditFormErrors({})
                  setEditUserPanelMode("edit")
                  setResetPasswordMode("email")
                  setNewPassword("")
                  setConfirmNewPassword("")
                  setDeleteConfirmation("")
                }}
                disabled={isUpdatingUser}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={isUpdatingUser}>
                {isUpdatingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          ) : editUserPanelMode === "reset_password" ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditUserPanelMode("edit")
                  setResetPasswordMode("email")
                  setNewPassword("")
                  setConfirmNewPassword("")
                }}
                disabled={resettingPassword}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!editingUser) return
                  void handleResetPassword(editingUser)
                }}
                disabled={
                  !editingUser ||
                  resettingPassword ||
                  (resetPasswordMode === "direct" && (!newPassword || newPassword !== confirmNewPassword))
                }
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {resetPasswordMode === "email" ? "Sending..." : "Resetting..."}
                  </>
                ) : resetPasswordMode === "email" ? (
                  "Send reset email"
                ) : (
                  "Set new password"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditUserPanelMode("edit")
                  setDeleteConfirmation("")
                }}
                disabled={isDeletingUser}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (!editingUser) return
                  void handleDeleteUser(editingUser)
                }}
                disabled={!editingUser || isDeletingUser || deleteConfirmation !== "DELETE"}
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete user"
                )}
              </Button>
            </div>
          )
        }
      >
        {editUserPanelMode === "edit" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {(editingUser?.profile?.name || editingUser?.email || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{editingUser?.profile?.name || "Unnamed user"}</div>
                <div className="text-muted-foreground truncate text-sm">{editingUser?.email || ""}</div>
              </div>
              {editingUser?.profile ? (
                <Badge variant={editingUser.profile.is_active ? "secondary" : "outline"}>
                  {editingUser.profile.is_active ? "Active" : "Inactive"}
                </Badge>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
                {editFormErrors.name && <p className="text-destructive text-sm">{editFormErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
                {editFormErrors.email && <p className="text-destructive text-sm">{editFormErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUserForm.role_id}
                  onValueChange={(value) => setEditUserForm((prev) => ({ ...prev, role_id: value }))}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {editSystemRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editFormErrors.role_id && <p className="text-destructive text-sm">{editFormErrors.role_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select
                  value={editUserForm.department_id || DEPARTMENT_NONE}
                  onValueChange={(value) => {
                    const nextDepartmentId = value === DEPARTMENT_NONE ? null : value
                    setEditUserForm((prev) => ({
                      ...prev,
                      department_id: nextDepartmentId,
                      department_role: DEPARTMENT_ROLE_NONE,
                    }))
                  }}
                  disabled={isUserAssignmentsLoading}
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder={isUserAssignmentsLoading ? "Loading..." : "Select a department"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEPARTMENT_NONE}>No department</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-department-role">Department role</Label>
                <Select
                  value={editUserForm.department_role || DEPARTMENT_ROLE_NONE}
                  onValueChange={(value) => setEditUserForm((prev) => ({ ...prev, department_role: value }))}
                  disabled={
                    !editUserForm.department_id || isUserAssignmentsLoading || isDepartmentProfessionRolesLoading
                  }
                >
                  <SelectTrigger id="edit-department-role">
                    <SelectValue
                      placeholder={
                        isUserAssignmentsLoading || isDepartmentProfessionRolesLoading
                          ? "Loading..."
                          : "Select a department role"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEPARTMENT_ROLE_NONE}>None</SelectItem>
                    {departmentRoleOptions.map((role) => (
                      <SelectItem key={role.key} value={role.key}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editFormErrors.department_role && (
                  <p className="text-destructive text-sm">{editFormErrors.department_role}</p>
                )}
              </div>

              {/* Department Access Level Manager */}
              {editUserForm.department_id && editingUser && (
                <div className="space-y-4">
                  <Separator />
                  <DepartmentAccessLevelManager
                    userId={editingUser.id}
                    departmentId={editUserForm.department_id}
                    onPendingChange={(value) => setEditUserForm((prev) => ({ ...prev, pendingAccessLevelId: value }))}
                    pendingValue={editUserForm.pendingAccessLevelId}
                  />
                </div>
              )}

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-is-active">Account status</Label>
                    <p className="text-muted-foreground text-sm">Inactive users cannot sign in.</p>
                    <p className="text-muted-foreground text-xs">Changes are saved when you click “Save changes.”</p>
                  </div>
                  <Switch
                    id="edit-is-active"
                    checked={editUserForm.is_active}
                    onCheckedChange={(checked) => setEditUserForm((prev) => ({ ...prev, is_active: checked }))}
                    disabled={!!editingUser && editingUser.id === currentUser?.id}
                  />
                </div>
                {!!editingUser && editingUser.id === currentUser?.id ? (
                  <p className="text-muted-foreground mt-2 text-sm">You cannot deactivate your own account.</p>
                ) : null}
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-verified">Email verification</Label>
                    <p className="text-muted-foreground text-sm">Controls whether the user is marked verified.</p>
                    <p className="text-muted-foreground text-xs">Changes are saved when you click “Save changes.”</p>
                  </div>
                  <Switch
                    id="email-verified"
                    checked={editUserForm.email_verified}
                    onCheckedChange={(checked) => setEditUserForm((prev) => ({ ...prev, email_verified: checked }))}
                    disabled={false}
                  />
                </div>
                {editingUser?.email_confirmed_at ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Verified on {new Date(editingUser.email_confirmed_at).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            </div>

            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="security">
                <AccordionTrigger className="px-3">Security</AccordionTrigger>
                <AccordionContent className="px-3">
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-sm">Reset the user password or send a reset link.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditUserPanelMode("reset_password")
                        setResetPasswordMode("email")
                        setNewPassword("")
                        setConfirmNewPassword("")
                      }}
                      disabled={!editingUser}
                    >
                      Reset password
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="danger">
                <AccordionTrigger className="px-3">Danger zone</AccordionTrigger>
                <AccordionContent className="px-3">
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      Deleting a user removes their profile and access. This cannot be undone.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setEditUserPanelMode("delete")
                        setDeleteConfirmation("")
                      }}
                      disabled={!editingUser}
                    >
                      Delete user
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : editUserPanelMode === "reset_password" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Reset password</p>
              <p className="text-muted-foreground text-sm">
                {editingUser?.email ? `For ${editingUser.email}` : "Choose a user to reset."}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={resetPasswordMode === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setResetPasswordMode("email")}
                className="flex-1"
              >
                Send reset email
              </Button>
              <Button
                type="button"
                variant={resetPasswordMode === "direct" ? "default" : "outline"}
                size="sm"
                onClick={() => setResetPasswordMode("direct")}
                className="flex-1"
              >
                Set new password
              </Button>
            </div>

            {resetPasswordMode === "email" ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  A password reset email will be sent to <strong>{editingUser?.email}</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 8 characters)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-8 w-8 p-0"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-8 w-8 p-0"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    >
                      {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Delete user</p>
              <p className="text-muted-foreground text-sm">
                This action cannot be undone. Type <strong>DELETE</strong> to confirm.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Confirmation</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE"
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </RightSidePanel>
    </div>
  )
}
