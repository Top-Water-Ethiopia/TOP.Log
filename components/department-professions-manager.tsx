"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { toast as sonnerToast } from "sonner"
import useSWR from "swr"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Minus, Plus, Pencil, Trash2, Users, Briefcase, UserPlus, X as XIcon } from "lucide-react"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

type RoleRow = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  level?: number
  created_at?: string
  updated_at?: string
}

type SearchUser = {
  user_id: string
  email: string | null
  name: string | null
}

type Department = {
  id: string
  name: string
}

type AssignmentRow = {
  id: string
  user_id: string
  department_id: string
  role_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  role?: {
    id: string
    name: string
    description: string | null
    department_id: string | null
    level?: number
  } | null
  user?: {
    user_id: string
    email: string | null
    name: string | null
  }
}

type Props = {
  departmentId: string
  embedded?: boolean
  defaultTab?: "roles" | "assignments"
}

export function DepartmentProfessionsManager({ departmentId, embedded = false, defaultTab = "roles" }: Props) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID

  const [tab, setTab] = useState<"roles" | "assignments">(defaultTab)

  const setTabAndUrl = (next: "roles" | "assignments") => {
    setTab(next)
    if (!embedded) return
    const rolesTab = next === "assignments" ? "assignments" : "roles"
    router.replace(`/admin/departments/${departmentId}?tab=roles&rolesTab=${rolesTab}`)
  }

  useEffect(() => {
    if (!embedded) return
    const rolesTab = searchParams.get("rolesTab")
    setTab(rolesTab === "assignments" || rolesTab === "members" ? "assignments" : "roles")
  }, [embedded, searchParams])

  const rolesKey = isAdmin && departmentId ? `/api/admin/departments/${departmentId}/profession-roles` : null
  const assignmentsKey =
    isAdmin && departmentId ? `/api/admin/departments/${departmentId}/profession-assignments` : null
  const departmentsKey = isAdmin ? "/api/admin/departments" : null

  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
    mutate: mutateRoles,
  } = useSWR<{ data: RoleRow[] }>(rolesKey)

  const {
    data: assignmentsResponse,
    error: assignmentsError,
    isLoading: isAssignmentsLoading,
    mutate: mutateAssignments,
  } = useSWR<{ data: AssignmentRow[] }>(assignmentsKey)

  const { data: departmentsResponse, error: departmentsError } = useSWR<{ data: Department[] }>(departmentsKey)

  const rolesLoading = isRolesLoading
  const assignmentsLoading = isAssignmentsLoading

  const rolesData = rolesResponse?.data
  const assignmentsData = assignmentsResponse?.data
  const departmentsData = departmentsResponse?.data

  const roles: RoleRow[] = Array.isArray(rolesData) ? rolesData : []
  const assignments: AssignmentRow[] = Array.isArray(assignmentsData) ? assignmentsData : []

  const [showInactive, setShowInactive] = useState(false)

  const departmentName = useMemo(() => {
    const depts: Department[] = Array.isArray(departmentsData) ? departmentsData : []
    const dept = depts.find((d) => d.id === departmentId)
    return dept?.name || null
  }, [departmentsData, departmentId])

  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [roleSaving, setRoleSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    level: "",
  })
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({})

  const [showDeleteRoleDialog, setShowDeleteRoleDialog] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<RoleRow | null>(null)
  const [roleDeleting, setRoleDeleting] = useState(false)

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [selectedActive, setSelectedActive] = useState(true)
  const [assignSaving, setAssignSaving] = useState(false)

  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [assignmentToRemove, setAssignmentToRemove] = useState<AssignmentRow | null>(null)
  const [assignmentToHardDelete, setAssignmentToHardDelete] = useState<AssignmentRow | null>(null)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")

  const [roleToViewMembers, setRoleToViewMembers] = useState<RoleRow | null>(null)

  const lastRolesErrorRef = useRef<string | null>(null)
  const lastAssignmentsErrorRef = useRef<string | null>(null)
  const lastDepartmentsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!rolesError) return
    const message = getErrorMessage(rolesError, "Failed to load profession roles")
    if (message === lastRolesErrorRef.current) return
    lastRolesErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [rolesError, toast])

  useEffect(() => {
    if (!assignmentsError) return
    const message = getErrorMessage(assignmentsError, "Failed to load profession assignments")
    if (message === lastAssignmentsErrorRef.current) return
    lastAssignmentsErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [assignmentsError, toast])

  useEffect(() => {
    if (!departmentsError) return
    const message = getErrorMessage(departmentsError, "Failed to load department")
    if (message === lastDepartmentsErrorRef.current) return
    lastDepartmentsErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [departmentsError, toast])

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  const validateRoleForm = () => {
    const errors: Record<string, string> = {}
    const name = roleForm.name.trim()
    if (!name) errors.name = "Role name is required"
    else if (!/^[a-z0-9-]+$/.test(name)) errors.name = "Use lowercase letters, numbers, and hyphens only"

    if (roleForm.level.trim()) {
      const n = Number(roleForm.level)
      if (!Number.isFinite(n) || n < 0) errors.level = "Level must be a non-negative number"
    }

    setRoleFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const al = typeof a.level === "number" ? a.level : 999999
      const bl = typeof b.level === "number" ? b.level : 999999
      if (al !== bl) return al - bl
      return a.name.localeCompare(b.name)
    })
  }, [roles])

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id
      const bn = b.user?.name || b.user?.email || b.user_id
      return an.localeCompare(bn)
    })
  }, [assignments])

  const membersForViewedRole = useMemo(() => {
    if (!roleToViewMembers) return []
    const relevant = assignments.filter((a) => a.role_id === roleToViewMembers.id)
    return [...relevant].sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id
      const bn = b.user?.name || b.user?.email || b.user_id
      return an.localeCompare(bn)
    })
  }, [assignments, roleToViewMembers])

  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm({ name: "", description: "", level: "" })
    setRoleFormErrors({})
    setShowRoleDialog(true)
  }

  const openEditRole = (r: RoleRow) => {
    setEditingRole(r)
    setRoleForm({
      name: r.name,
      description: r.description || "",
      level: typeof r.level === "number" ? String(r.level) : "",
    })
    setRoleFormErrors({})
    setShowRoleDialog(true)
  }

  const saveRole = async () => {
    if (!validateRoleForm() || roleSaving) return

    const prevRolesResponse = rolesResponse
    const prevAssignmentsResponse = assignmentsResponse

    try {
      setRoleSaving(true)
      const payload: { name: string; description: string | null; level?: number } = {
        name: roleForm.name.trim().toLowerCase(),
        description: roleForm.description.trim() || null,
      }
      if (roleForm.level.trim()) payload.level = Number(roleForm.level)
      const nowIso = new Date().toISOString()

      let optimisticRoleId: string | null = null

      if (rolesKey) {
        if (editingRole) {
          mutateRoles(
            (current) => {
              const currentData = current?.data
              const rows = Array.isArray(currentData) ? currentData : []
              const nextRows = rows.map((r) =>
                r.id === editingRole.id
                  ? {
                      ...r,
                      ...payload,
                      updated_at: nowIso,
                    }
                  : r
              )
              return { data: nextRows }
            },
            { revalidate: false }
          )

          mutateAssignments(
            (current) => {
              const currentData = current?.data
              const rows = Array.isArray(currentData) ? currentData : []
              const nextRows = rows.map((a) => {
                if (a.role_id !== editingRole.id) return a
                if (!a.role) return a
                return {
                  ...a,
                  role: {
                    ...a.role,
                    name: payload.name,
                    description: payload.description,
                    level: payload.level,
                  },
                }
              })
              return { data: nextRows }
            },
            { revalidate: false }
          )
        } else {
          optimisticRoleId = `temp-${Date.now()}`
          const optimistic: RoleRow = {
            id: optimisticRoleId,
            name: payload.name,
            description: payload.description,
            department_id: departmentId,
            level: payload.level,
            created_at: nowIso,
            updated_at: nowIso,
          }

          mutateRoles(
            (current) => {
              const currentData = current?.data
              const rows = Array.isArray(currentData) ? currentData : []
              return { data: [...rows, optimistic] }
            },
            { revalidate: false }
          )
        }
      }

      const saved = await apiFetch<{ data: RoleRow }>(`/api/admin/departments/${departmentId}/profession-roles`, {
        method: editingRole ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRole ? { ...payload, id: editingRole.id } : payload),
      })

      if (saved?.data?.id && rolesKey) {
        mutateRoles(
          (current) => {
            const currentData = current?.data
            const rows = Array.isArray(currentData) ? currentData : []
            const nextRows = editingRole
              ? rows.map((r) => (r.id === editingRole.id ? saved.data : r))
              : optimisticRoleId
                ? rows.map((r) => (r.id === optimisticRoleId ? saved.data : r))
                : [...rows, saved.data]
            return { data: nextRows }
          },
          { revalidate: false }
        )
      }

      if (editingRole && saved?.data?.id) {
        mutateAssignments(
          (current) => {
            const currentData = current?.data
            const rows = Array.isArray(currentData) ? currentData : []
            const nextRows = rows.map((a) => {
              if (a.role_id !== saved.data.id) return a
              if (!a.role) return a
              return {
                ...a,
                role: {
                  ...a.role,
                  id: saved.data.id,
                  name: saved.data.name,
                  description: saved.data.description,
                  department_id: saved.data.department_id,
                  level: saved.data.level,
                },
              }
            })
            return { data: nextRows }
          },
          { revalidate: false }
        )
      }

      toast({
        title: "Saved",
        description: editingRole ? "Profession role updated" : "Profession role created",
      })

      setShowRoleDialog(false)
    } catch (error: any) {
      const apiError = error instanceof ApiError ? error : null
      if (prevRolesResponse) {
        mutateRoles(prevRolesResponse, { revalidate: false })
      } else {
        mutateRoles()
      }

      if (prevAssignmentsResponse) {
        mutateAssignments(prevAssignmentsResponse, { revalidate: false })
      } else {
        mutateAssignments()
      }

      toast({
        title: "Error",
        description: apiError ? apiError.message : getErrorMessage(error, "Failed to save role"),
        variant: "destructive",
      })
    } finally {
      setRoleSaving(false)
      mutateRoles()
    }
  }

  const confirmDeleteRole = (r: RoleRow) => {
    setRoleToDelete(r)
    setShowDeleteRoleDialog(true)
  }

  const deleteRole = async () => {
    if (!roleToDelete || roleDeleting) return

    const prevRolesResponse = rolesResponse

    try {
      setRoleDeleting(true)

      mutateRoles(
        (current) => {
          const currentData = current?.data
          const rows = Array.isArray(currentData) ? currentData : []
          const nextRows = rows.filter((r) => r.id !== roleToDelete.id)
          return { data: nextRows }
        },
        { revalidate: false }
      )

      await apiFetch<{ success: boolean }>(
        `/api/admin/departments/${departmentId}/profession-roles?id=${encodeURIComponent(roleToDelete.id)}`,
        { method: "DELETE" }
      )

      toast({ title: "Deleted", description: "Profession role deleted" })
      setShowDeleteRoleDialog(false)
      setRoleToDelete(null)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        toast({
          title: "Cannot delete role",
          description: getErrorMessage(
            error,
            "Cannot delete role. It may have users assigned or role questions. Please remove dependencies first."
          ),
          variant: "destructive",
          action: (
            <ToastAction altText="View assignments" onClick={() => setTabAndUrl("assignments")}>
              View assignments
            </ToastAction>
          ),
        })
      } else {
        toast({
          title: "Error",
          description: getErrorMessage(error, "Failed to delete role"),
          variant: "destructive",
        })
      }
      if (prevRolesResponse) {
        mutateRoles(prevRolesResponse, { revalidate: false })
      } else {
        mutateRoles()
      }
    } finally {
      setRoleDeleting(false)
      mutateRoles()
    }
  }

  const openAssign = (preSelectedRoleId?: string) => {
    setShowAssignDialog(true)
    setUserQuery("")
    setSearchResults([])
    setSelectedUserId(null)
    setSelectedRoleId(preSelectedRoleId || sortedRoles[0]?.id || null)
    setSelectedActive(true)
  }

  const runUserSearch = async () => {
    const q = userQuery.trim()
    if (!q) return

    try {
      setSearchLoading(true)
      const json = await apiFetch<{ data: SearchUser[] }>(`/api/admin/users/search?query=${encodeURIComponent(q)}`)
      setSearchResults((json.data || []) as SearchUser[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to search users"),
        variant: "destructive",
      })
    } finally {
      setSearchLoading(false)
    }
  }

  const saveAssignment = async () => {
    if (!selectedUserId) {
      toast({
        title: "Missing user",
        description: "Select a user to assign",
        variant: "destructive",
      })
      return
    }

    if (!selectedRoleId) {
      toast({
        title: "Missing role",
        description: "Select a profession role",
        variant: "destructive",
      })
      return
    }

    const prevAssignmentsResponse = assignmentsResponse

    try {
      setAssignSaving(true)
      const role = rolesById.get(selectedRoleId)
      const selectedUser = searchResults.find((u) => u.user_id === selectedUserId) || null
      const nowIso = new Date().toISOString()
      const existing = assignments.find((a) => a.user_id === selectedUserId) || null

      mutateAssignments(
        (current) => {
          const currentData = current?.data
          const rows = Array.isArray(currentData) ? currentData : []
          const optimistic: AssignmentRow = existing
            ? {
                ...existing,
                role_id: selectedRoleId,
                is_active: selectedActive,
                updated_at: nowIso,
                role: role
                  ? {
                      id: role.id,
                      name: role.name,
                      description: role.description,
                      department_id: role.department_id,
                      level: role.level,
                    }
                  : existing.role,
                user:
                  existing.user ||
                  (selectedUser
                    ? { user_id: selectedUser.user_id, email: selectedUser.email, name: selectedUser.name }
                    : { user_id: selectedUserId, email: null, name: null }),
              }
            : {
                id: `temp-${Date.now()}`,
                user_id: selectedUserId,
                department_id: departmentId,
                role_id: selectedRoleId,
                is_active: selectedActive,
                created_at: nowIso,
                updated_at: nowIso,
                role: role
                  ? {
                      id: role.id,
                      name: role.name,
                      description: role.description,
                      department_id: role.department_id,
                      level: role.level,
                    }
                  : null,
                user: selectedUser
                  ? { user_id: selectedUser.user_id, email: selectedUser.email, name: selectedUser.name }
                  : { user_id: selectedUserId, email: null, name: null },
              }

          const nextRows = existing
            ? rows.map((a) => (a.user_id === selectedUserId ? optimistic : a))
            : [...rows.filter((a) => a.user_id !== selectedUserId), optimistic]

          return { data: nextRows }
        },
        { revalidate: false }
      )

      const saved = await apiFetch<{
        data: {
          id: string
          user_id: string
          department_id: string
          role_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }>(`/api/admin/departments/${departmentId}/profession-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          role_id: selectedRoleId,
          is_active: selectedActive,
        }),
      })

      if (saved?.data?.id) {
        mutateAssignments(
          (current) => {
            const currentData = current?.data
            const rows = Array.isArray(currentData) ? currentData : []
            const nextRows = rows.map((a) => {
              if (a.user_id !== selectedUserId) return a
              return {
                ...a,
                ...saved.data,
              }
            })
            return { data: nextRows }
          },
          { revalidate: false }
        )
      }

      sonnerToast.success("Saved", {
        description: "Profession assignment updated",
      })
      setShowAssignDialog(false)
    } catch (error: any) {
      if (prevAssignmentsResponse) {
        mutateAssignments(prevAssignmentsResponse, { revalidate: false })
      } else {
        mutateAssignments()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save assignment"),
        variant: "destructive",
      })
    } finally {
      setAssignSaving(false)
      mutateAssignments()
    }
  }

  const confirmRemoveAssignment = (a: AssignmentRow) => {
    setAssignmentToRemove(a)
  }

  const removeAssignment = async () => {
    if (!assignmentToRemove) return

    const prevAssignmentsResponse = assignmentsResponse

    try {
      setRemovingUserId(assignmentToRemove.user_id)
      const removedUserId = assignmentToRemove.user_id
      const removedDisplayName = assignmentToRemove.user?.name || assignmentToRemove.user?.email || removedUserId
      const prevRoleId = assignmentToRemove.role_id

      // Update the assignment's is_active status instead of removing it
      mutateAssignments(
        (current) => {
          const currentData = current?.data
          const rows = Array.isArray(currentData) ? currentData : []
          return {
            data: rows.map((a) => (a.user_id === removedUserId ? { ...a, is_active: false } : a)),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{ data: unknown }>(
        `/api/admin/departments/${departmentId}/profession-assignments/${removedUserId}`,
        { method: "DELETE" }
      )

      sonnerToast.success("Deactivated", {
        description: `${removedDisplayName} was deactivated from this role`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              // Update the assignment's is_active status
              mutateAssignments(
                (current) => {
                  const currentData = current?.data
                  const rows = Array.isArray(currentData) ? currentData : []
                  return {
                    data: rows.map((a) => (a.user_id === removedUserId ? { ...a, is_active: true } : a)),
                  }
                },
                { revalidate: false }
              )

              await apiFetch<{ data: unknown }>(`/api/admin/departments/${departmentId}/profession-assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id: removedUserId,
                  role_id: prevRoleId,
                  is_active: true,
                }),
              })

              sonnerToast.success("Restored", {
                description: `${removedDisplayName}'s access has been restored`,
              })
            } catch (e: any) {
              mutateAssignments()
              sonnerToast.error("Error", {
                description: getErrorMessage(e, "Failed to restore assignment"),
              })
            } finally {
              mutateAssignments()
            }
          },
        },
      })

      setAssignmentToRemove(null)
    } catch (error: any) {
      if (prevAssignmentsResponse) {
        mutateAssignments(prevAssignmentsResponse, { revalidate: false })
      } else {
        mutateAssignments()
      }

      sonnerToast.error("Error", {
        description: getErrorMessage(error, "Failed to deactivate assignment"),
      })
    } finally {
      setRemovingUserId(null)
      mutateAssignments()
    }
  }

  const hardDeleteAssignment = async () => {
    if (!assignmentToHardDelete) return

    const prevAssignmentsResponse = assignmentsResponse

    try {
      setRemovingUserId(assignmentToHardDelete.user_id)
      const removedUserId = assignmentToHardDelete.user_id
      const removedDisplayName =
        assignmentToHardDelete.user?.name || assignmentToHardDelete.user?.email || removedUserId

      // Remove the assignment from the list entirely
      mutateAssignments(
        (current) => {
          const currentData = current?.data
          const rows = Array.isArray(currentData) ? currentData : []
          return { data: rows.filter((a) => a.user_id !== removedUserId) }
        },
        { revalidate: false }
      )

      await apiFetch<{ data: unknown }>(
        `/api/admin/departments/${departmentId}/profession-assignments/${removedUserId}?mode=hard`,
        { method: "DELETE" }
      )

      sonnerToast.success("Permanently deleted", {
        description: `${removedDisplayName}'s assignment was permanently deleted`,
      })

      setAssignmentToHardDelete(null)
      setHardDeleteConfirmText("")
    } catch (error: any) {
      if (prevAssignmentsResponse) {
        mutateAssignments(prevAssignmentsResponse, { revalidate: false })
      } else {
        mutateAssignments()
      }

      sonnerToast.error("Error", {
        description: getErrorMessage(error, "Failed to delete assignment"),
      })
    } finally {
      setRemovingUserId(null)
      mutateAssignments()
    }
  }

  if (isLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
        <Skeleton className="h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to manage professions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant={tab === "roles" ? "default" : "outline"} onClick={() => setTabAndUrl("roles")}>
            <Briefcase className="mr-2 h-4 w-4" />
            Roles
          </Button>
          <Button variant={tab === "assignments" ? "default" : "outline"} onClick={() => setTabAndUrl("assignments")}>
            <Users className="mr-2 h-4 w-4" />
            Assignments
          </Button>
        </div>
      ) : (
        <div className="bg-background flex flex-col gap-4 rounded-xl border p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {departmentName ? `${departmentName} profession roles` : "Profession roles"}
            </h1>
            <p className="text-muted-foreground mt-2">
              Define profession roles for this department, then assign each user to one role.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant={tab === "roles" ? "default" : "outline"} onClick={() => setTab("roles")}>
              <Briefcase className="mr-2 h-4 w-4" />
              Roles
            </Button>
            <Button variant={tab === "assignments" ? "default" : "outline"} onClick={() => setTab("assignments")}>
              <Users className="mr-2 h-4 w-4" />
              Assignments
            </Button>
          </div>
        </div>
      )}

      {tab === "roles" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Profession Roles</CardTitle>
              <CardDescription>Create and manage roles specific to this department.</CardDescription>
            </div>
            <Button onClick={openCreateRole} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Create role
            </Button>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : sortedRoles.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No roles yet. Create your first role to start assigning members.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedRoles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{r.name}</div>
                        {typeof r.level === "number" && <Badge variant="secondary">level {r.level}</Badge>}
                      </div>
                      <div className="text-muted-foreground truncate text-sm">{r.description || "-"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Show members"
                            onClick={() => setRoleToViewMembers(r)}
                            disabled={assignmentsLoading}
                          >
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>Show members</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 text-xs"
                        onClick={() => openAssign(r.id)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Assign member</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRole(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/90 h-8 w-8"
                        onClick={() => confirmDeleteRole(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Department Members</CardTitle>
              <CardDescription>Each member can have one profession role in this department.</CardDescription>
            </div>
            <Button onClick={() => openAssign()} className="shrink-0" disabled={sortedRoles.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Assign member
            </Button>
          </CardHeader>
          <CardContent>
            {sortedRoles.length === 0 ? (
              <div className="text-muted-foreground text-sm">Create at least one role before assigning members.</div>
            ) : assignmentsLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : sortedAssignments.length === 0 ? (
              <div className="text-muted-foreground text-sm">No members assigned to roles yet.</div>
            ) : (
              <div className="space-y-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    {sortedAssignments.length} assignment{sortedAssignments.length !== 1 ? "s" : ""} •{" "}
                    {assignments.filter((a) => !a.is_active).length} inactive
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="show-inactive" className="text-muted-foreground text-sm font-medium">
                      Show inactive
                    </label>
                    <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                  </div>
                </div>
                {sortedAssignments
                  .filter((a) => showInactive || a.is_active)
                  .map((a) => {
                    const role = a.role || rolesById.get(a.role_id) || null
                    const roleName = role?.name || a.role_id
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-md border p-3 ${
                          !a.is_active ? "bg-muted/30 opacity-70" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate font-medium">{a.user?.name || "Unknown"}</div>
                            {!a.is_active && (
                              <Badge variant="outline" className="border-dashed">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-sm">{a.user?.email || a.user_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={a.is_active ? "secondary" : "outline"}>{roleName}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit assignment"
                            onClick={() => {
                              setShowAssignDialog(true)
                              setSelectedUserId(a.user_id)
                              setSelectedRoleId(a.role_id)
                              setSelectedActive(a.is_active)
                              setUserQuery(a.user?.email || a.user?.name || "")
                              setSearchResults([])
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={a.is_active ? "Deactivate assignment" : "Delete assignment"}
                            disabled={!!removingUserId && removingUserId === a.user_id}
                            onClick={() => confirmRemoveAssignment(a)}
                          >
                            {a.is_active ? (
                              <Trash2 className="text-destructive h-4 w-4" />
                            ) : (
                              <Trash2 className="text-destructive/60 h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                {!showInactive && assignments.some((a) => !a.is_active) && (
                  <div className="text-muted-foreground pt-2 text-center text-sm">
                    {assignments.filter((a) => !a.is_active).length} inactive assignment
                    {assignments.filter((a) => !a.is_active).length !== 1 ? "s" : ""} hidden.{" "}
                    <button onClick={() => setShowInactive(true)} className="text-primary hover:underline">
                      Show all
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RightSidePanel
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        title={editingRole ? "Edit profession role" : "Create profession role"}
        description="Profession roles are department-specific and used to determine which report questions a user sees."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={roleSaving}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={roleSaving}>
              {editingRole ? "Update role" : "Add role"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="profession_role_name">Role name</Label>
            <Input
              id="profession_role_name"
              value={roleForm.name}
              onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. deckhand"
            />
            {roleFormErrors.name && <div className="text-destructive text-sm">{roleFormErrors.name}</div>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profession_role_description">Description</Label>
            <Textarea
              id="profession_role_description"
              value={roleForm.description}
              onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profession_role_level">Level</Label>
            <div className="text-muted-foreground text-xs">Defines the hierarchy weight of this role</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Decrease level"
                onClick={() => {
                  const current = Number.parseInt(roleForm.level || "0", 10)
                  const safe = Number.isFinite(current) ? current : 0
                  const next = Math.max(0, safe - 1)
                  setRoleForm((p) => ({ ...p, level: String(next) }))
                }}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="profession_role_level"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={roleForm.level}
                onChange={(e) => setRoleForm((p) => ({ ...p, level: e.target.value }))}
                placeholder="Optional"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Increase level"
                onClick={() => {
                  const current = Number.parseInt(roleForm.level || "0", 10)
                  const safe = Number.isFinite(current) ? current : 0
                  const next = safe + 1
                  setRoleForm((p) => ({ ...p, level: String(next) }))
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {roleFormErrors.level && <div className="text-destructive text-sm">{roleFormErrors.level}</div>}
          </div>
        </div>
      </RightSidePanel>

      <Dialog open={!!roleToViewMembers} onOpenChange={(open) => !open && setRoleToViewMembers(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleToViewMembers ? `Members: ${roleToViewMembers.name}` : "Members"}</DialogTitle>
            <DialogDescription>Users assigned to this profession role in this department.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {assignmentsLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : membersForViewedRole.length === 0 ? (
              <div className="text-muted-foreground text-sm">No members assigned to this role.</div>
            ) : (
              <div className="space-y-2">
                {membersForViewedRole.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.user?.name || "Unknown"}</div>
                      <div className="text-muted-foreground truncate text-sm">{a.user?.email || a.user_id}</div>
                    </div>
                    <Badge variant={a.is_active ? "secondary" : "outline"}>{a.is_active ? "active" : "inactive"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleToViewMembers(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showDeleteRoleDialog}
        onOpenChange={(open) => {
          setShowDeleteRoleDialog(open)
          if (!open) setRoleToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the role. If users are assigned or role questions exist, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={roleDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={roleDeleting} onClick={deleteRole}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign member to role</DialogTitle>
            <DialogDescription>Select a member, then choose their role for this department.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">User</div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        runUserSearch()
                      }
                    }}
                    placeholder="Search by email, name, or username"
                    className={userQuery ? "pr-8" : undefined}
                  />
                  {userQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserQuery("")
                        setSelectedUserId(null)
                        setSearchResults([])
                      }}
                      className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-2 my-auto flex h-4 w-4 items-center justify-center rounded-full focus:outline-none"
                      aria-label="Clear user search"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <Button variant="outline" onClick={runUserSearch} disabled={searchLoading}>
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-md border">
                  {searchResults.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      className={`hover:bg-muted w-full px-4 py-2 text-left text-sm ${
                        selectedUserId === u.user_id ? "bg-muted" : ""
                      }`}
                      onClick={() => setSelectedUserId(u.user_id)}
                    >
                      <div className="font-medium">{u.name || "Unknown"}</div>
                      <div className="text-muted-foreground">{u.email || u.user_id}</div>
                    </button>
                  ))}
                </div>
              )}

              {selectedUserId && (
                <div className="text-muted-foreground text-xs">Selected user_id: {selectedUserId}</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Profession role</div>
              <Select value={selectedRoleId || ""} onValueChange={(v) => setSelectedRoleId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-muted-foreground text-xs">
                  Inactive disables question visibility without deleting history.
                </div>
              </div>
              <Switch checked={selectedActive} onCheckedChange={setSelectedActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={assignSaving}>
              Cancel
            </Button>
            <Button onClick={saveAssignment} disabled={assignSaving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!assignmentToRemove} onOpenChange={(open) => !open && setAssignmentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {assignmentToRemove?.is_active ? "Deactivate assignment" : "Delete assignment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentToRemove?.is_active
                ? "This will deactivate the assignment. The user will no longer have access to this role, but the history will be preserved."
                : "This will permanently delete the assignment. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingUserId}>Cancel</AlertDialogCancel>
            {assignmentToRemove?.is_active && (
              <Button
                variant="destructive"
                disabled={!!removingUserId}
                onClick={() => {
                  if (!assignmentToRemove) return
                  setAssignmentToHardDelete(assignmentToRemove)
                  setAssignmentToRemove(null)
                }}
              >
                Permanently delete
              </Button>
            )}
            <AlertDialogAction
              disabled={!!removingUserId}
              onClick={assignmentToRemove?.is_active ? removeAssignment : hardDeleteAssignment}
              className={
                !assignmentToRemove?.is_active
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {assignmentToRemove?.is_active ? "Deactivate" : "Permanently delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!assignmentToHardDelete}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentToHardDelete(null)
            setHardDeleteConfirmText("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete assignment</DialogTitle>
            <DialogDescription>This cannot be undone. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input value={hardDeleteConfirmText} onChange={(e) => setHardDeleteConfirmText(e.target.value)} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignmentToHardDelete(null)
                setHardDeleteConfirmText("")
              }}
              disabled={!!removingUserId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={hardDeleteAssignment}
              disabled={!!removingUserId || hardDeleteConfirmText !== "DELETE"}
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
