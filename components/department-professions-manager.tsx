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
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { toast as sonnerToast } from "sonner"
import useSWR from "swr"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Briefcase, Minus, MoreVertical, Pencil, Plus, Search, Trash2, Users, UserPlus, X as XIcon } from "lucide-react"

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

type DepartmentMembershipRow = {
  id: string
  user_id: string
  department_id: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  user?: {
    user_id: string
    email: string | null
    name: string | null
  }
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
  const membershipsKey = isAdmin && departmentId ? `/api/admin/departments/${departmentId}/memberships` : null
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

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: isMembershipsLoading,
  } = useSWR<{
    data: DepartmentMembershipRow[]
  }>(membershipsKey)

  const { data: departmentsResponse, error: departmentsError } = useSWR<{ data: Department[] }>(departmentsKey)

  const rolesLoading = isRolesLoading
  const assignmentsLoading = isAssignmentsLoading
  const membershipsLoading = isMembershipsLoading

  const rolesData = rolesResponse?.data
  const assignmentsData = assignmentsResponse?.data
  const membershipsData = membershipsResponse?.data
  const departmentsData = departmentsResponse?.data

  const roles: RoleRow[] = useMemo(() => (Array.isArray(rolesData) ? rolesData : []), [rolesData])
  const assignments: AssignmentRow[] = useMemo(
    () => (Array.isArray(assignmentsData) ? assignmentsData : []),
    [assignmentsData]
  )
  const memberships: DepartmentMembershipRow[] = useMemo(
    () => (Array.isArray(membershipsData) ? membershipsData : []),
    [membershipsData]
  )

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

  const [roleToDelete, setRoleToDelete] = useState<RoleRow | null>(null)
  const [roleDeleting, setRoleDeleting] = useState(false)
  const [showDeleteRolePanel, setShowDeleteRolePanel] = useState(false)
  const [deleteRoleConfirmText, setDeleteRoleConfirmText] = useState("")

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [memberQuery, setMemberQuery] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set())
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [selectedActive, setSelectedActive] = useState(true)
  const [assignSaving, setAssignSaving] = useState(false)

  const [confirmBulkReassignOpen, setConfirmBulkReassignOpen] = useState(false)
  const [pendingBulkReassign, setPendingBulkReassign] = useState<{
    userIds: string[]
    toRoleId: string
  } | null>(null)

  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [assignmentToRemove, setAssignmentToRemove] = useState<AssignmentRow | null>(null)
  const [showAssignmentDeletePanel, setShowAssignmentDeletePanel] = useState(false)
  const [assignmentDeletePanelMode, setAssignmentDeletePanelMode] = useState<"deactivate" | "hard_delete">("deactivate")
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")

  const [roleToViewMembers, setRoleToViewMembers] = useState<RoleRow | null>(null)

  const [roleSearchQuery, setRoleSearchQuery] = useState("")

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
    if (!membershipsError) return
    const message = getErrorMessage(membershipsError, "Failed to load department members")
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [membershipsError, toast])

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

  const membersCountByRoleId = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assignments) {
      if (!a.is_active) continue
      map.set(a.role_id, (map.get(a.role_id) || 0) + 1)
    }
    return map
  }, [assignments])

  const filteredRoles = useMemo(() => {
    const q = roleSearchQuery.trim().toLowerCase()
    if (!q) return sortedRoles
    return sortedRoles.filter((r) => {
      const name = r.name.toLowerCase()
      const description = (r.description || "").toLowerCase()
      const level = typeof r.level === "number" ? String(r.level) : ""
      return name.includes(q) || description.includes(q) || level.includes(q)
    })
  }, [roleSearchQuery, sortedRoles])

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
    } catch (error: unknown) {
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
    setDeleteRoleConfirmText("")
    setShowDeleteRolePanel(true)
  }

  const deleteRole = async () => {
    if (!roleToDelete || roleDeleting) return
    if (deleteRoleConfirmText !== "DELETE") return

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
      setShowDeleteRolePanel(false)
      setRoleToDelete(null)
      setDeleteRoleConfirmText("")
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

  const openAssign = (preSelectedRoleId?: string, preSelectedUserIds?: string[], preSelectedActive = true) => {
    const roleId = preSelectedRoleId || sortedRoles[0]?.id || null
    setShowAssignDialog(true)
    setMemberQuery("")
    setSelectedRoleId(roleId)
    setSelectedActive(preSelectedActive)

    if (roleId) {
      if (preSelectedUserIds && preSelectedUserIds.length > 0) {
        setSelectedUserIds(new Set(preSelectedUserIds))
      } else {
        const assigned = assignments.filter((a) => a.role_id === roleId).map((a) => a.user_id)
        setSelectedUserIds(new Set(assigned))
      }
    } else {
      setSelectedUserIds(new Set())
    }
  }

  useEffect(() => {
    if (showAssignDialog) return
    setConfirmBulkReassignOpen(false)
    setPendingBulkReassign(null)
    setMemberQuery("")
    setSelectedUserIds(new Set())
  }, [showAssignDialog])

  useEffect(() => {
    if (!showAssignDialog) return
    if (!selectedRoleId) return
    const assigned = assignments.filter((a) => a.role_id === selectedRoleId).map((a) => a.user_id)
    setSelectedUserIds(new Set(assigned))
  }, [assignments, selectedRoleId, showAssignDialog])

  const assignmentByUserId = useMemo(() => {
    const map = new Map<string, AssignmentRow>()
    for (const a of assignments) {
      const existing = map.get(a.user_id)
      if (!existing) {
        map.set(a.user_id, a)
        continue
      }
      if (existing.is_active && !a.is_active) continue
      if (!existing.is_active && a.is_active) {
        map.set(a.user_id, a)
        continue
      }
    }
    return map
  }, [assignments])

  const membersForPicker = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    const sorted = [...memberships]
      .map((m) => {
        const u = m.user
        return {
          user_id: m.user_id,
          name: u?.name || null,
          email: u?.email || null,
          is_active: m.is_active,
        }
      })
      .sort((a, b) => {
        const an = a.name || a.email || a.user_id
        const bn = b.name || b.email || b.user_id
        return an.localeCompare(bn)
      })

    if (!q) return sorted

    return sorted.filter((u) => {
      const name = (u.name || "").toLowerCase()
      const email = (u.email || "").toLowerCase()
      const id = (u.user_id || "").toLowerCase()
      return name.includes(q) || email.includes(q) || id.includes(q)
    })
  }, [memberQuery, memberships])

  const handleSaveAssignmentClick = () => {
    if (!selectedRoleId) {
      toast({
        title: "Missing role",
        description: "Select a profession role",
        variant: "destructive",
      })
      return
    }

    const ids = Array.from(selectedUserIds)
    if (ids.length === 0) {
      toast({
        title: "No members selected",
        description: "Select at least one member to assign",
        variant: "destructive",
      })
      return
    }

    const conflicts = ids.filter((userId) => {
      const existing = assignmentByUserId.get(userId)
      return !!existing && existing.role_id !== selectedRoleId
    })

    if (conflicts.length > 0) {
      setPendingBulkReassign({ userIds: ids, toRoleId: selectedRoleId })
      setConfirmBulkReassignOpen(true)
      return
    }

    saveAssignmentsBulk(ids, selectedRoleId)
  }

  const saveAssignmentsBulk = async (userIds: string[], roleId: string) => {
    if (assignSaving) return
    const prevAssignmentsResponse = assignmentsResponse

    try {
      setAssignSaving(true)
      await Promise.all(
        userIds.map((userId) =>
          apiFetch<{ data: unknown }>(`/api/admin/departments/${departmentId}/profession-assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              role_id: roleId,
              is_active: selectedActive,
            }),
          })
        )
      )

      sonnerToast.success("Saved", {
        description: `Assigned ${userIds.length} member${userIds.length === 1 ? "" : "s"}`,
      })

      setShowAssignDialog(false)
    } catch (error: unknown) {
      if (prevAssignmentsResponse) {
        mutateAssignments(prevAssignmentsResponse, { revalidate: false })
      } else {
        mutateAssignments()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save assignments"),
        variant: "destructive",
      })
    } finally {
      setAssignSaving(false)
      mutateAssignments()
    }
  }

  const confirmRemoveAssignment = (a: AssignmentRow) => {
    setAssignmentToRemove(a)
    setHardDeleteConfirmText("")
    setAssignmentDeletePanelMode(a.is_active ? "deactivate" : "hard_delete")
    setShowAssignmentDeletePanel(true)
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
            } catch (e: unknown) {
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

      setShowAssignmentDeletePanel(false)
      setAssignmentToRemove(null)
    } catch (error: unknown) {
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
    if (!assignmentToRemove) return
    if (hardDeleteConfirmText !== "DELETE") return

    const prevAssignmentsResponse = assignmentsResponse

    try {
      setRemovingUserId(assignmentToRemove.user_id)
      const removedUserId = assignmentToRemove.user_id
      const removedDisplayName = assignmentToRemove.user?.name || assignmentToRemove.user?.email || removedUserId

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

      setShowAssignmentDeletePanel(false)
      setAssignmentToRemove(null)
      setHardDeleteConfirmText("")
    } catch (error: unknown) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant={tab === "roles" ? "default" : "outline"} size="sm" onClick={() => setTabAndUrl("roles")}>
              Roles
            </Button>
            <Button
              variant={tab === "assignments" ? "default" : "outline"}
              size="sm"
              onClick={() => setTabAndUrl("assignments")}
            >
              Assignments
            </Button>
          </div>
          {tab === "roles" ? (
            <Button size="sm" onClick={openCreateRole}>
              <Plus className="mr-2 h-4 w-4" />
              Create role
            </Button>
          ) : (
            <Button size="sm" onClick={() => openAssign()} disabled={sortedRoles.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Assign member
            </Button>
          )}
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
        <div className="dark:bg-background rounded-lg border border-gray-200 bg-white dark:border-gray-700">
          <div className="border-b border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredRoles.length} professional role{filteredRoles.length === 1 ? "" : "s"}
              </div>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search roles..."
                  className="h-9 w-64 border-gray-200 bg-gray-50 pl-9 dark:border-gray-600 dark:bg-gray-800"
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Role Name
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Level
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Description
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Members
                  </TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                      No roles yet. Create your first role to start assigning members.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((r) => {
                    const memberCount = membersCountByRoleId.get(r.id) || 0
                    return (
                      <TableRow key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                        <TableCell className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{r.name}</div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {typeof r.level === "number" ? (
                            <Badge variant="secondary">{r.level}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-normal">
                          <div className="max-w-xs text-sm wrap-break-word text-gray-600 dark:text-gray-400">
                            {r.description || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {memberCount} member{memberCount === 1 ? "" : "s"}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <ActionMenu
                            trigger={
                              <Button variant="ghost" size="icon" disabled={assignmentsLoading}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                            items={
                              [
                                { type: "label", label: r.name },
                                { type: "separator" },
                                {
                                  type: "item",
                                  label: "Assign members",
                                  icon: <UserPlus className="mr-2 h-4 w-4" />,
                                  onSelect: () => openAssign(r.id),
                                },
                                {
                                  type: "item",
                                  label: "View members",
                                  icon: <Users className="mr-2 h-4 w-4" />,
                                  onSelect: () => setRoleToViewMembers(r),
                                },
                                {
                                  type: "item",
                                  label: "Edit role",
                                  icon: <Pencil className="mr-2 h-4 w-4" />,
                                  onSelect: () => openEditRole(r),
                                },
                                { type: "separator" },
                                {
                                  type: "item",
                                  label: "Delete role",
                                  icon: <Trash2 className="text-destructive mr-2 h-4 w-4" />,
                                  destructive: true,
                                  onSelect: () => confirmDeleteRole(r),
                                },
                              ] satisfies ActionMenuItem[]
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Department Members</CardTitle>
              <CardDescription>Each member can have one profession role in this department.</CardDescription>
            </div>
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
                  {(() => {
                    const inactiveCount = assignments.filter((a) => !a.is_active).length
                    const activeCount = assignments.length - inactiveCount

                    return (
                      <>
                        <div className="text-muted-foreground text-sm">
                          {sortedAssignments.length} assignment{sortedAssignments.length !== 1 ? "s" : ""} •{" "}
                          {inactiveCount} inactive
                        </div>
                        {activeCount > 0 ? (
                          <div className="flex items-center space-x-2">
                            <label htmlFor="show-inactive" className="text-muted-foreground text-sm font-medium">
                              Show inactive
                            </label>
                            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
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
                            <div className="truncate text-sm leading-none font-medium">{a.user?.name || "Unknown"}</div>
                            {!a.is_active && (
                              <Badge variant="outline" className="border-dashed">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-xs leading-none">
                            {a.user?.email || a.user_id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={a.is_active ? "secondary" : "outline"}>{roleName}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit assignment"
                            onClick={() => {
                              openAssign(a.role_id, [a.user_id], a.is_active)
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

      <RightSidePanel
        open={!!roleToViewMembers}
        onOpenChange={(open) => {
          if (!open) setRoleToViewMembers(null)
        }}
        title={roleToViewMembers ? `Members: ${roleToViewMembers.name}` : "Members"}
        description="Users assigned to this profession role in this department."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRoleToViewMembers(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-2 pt-4">
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
      </RightSidePanel>

      <RightSidePanel
        open={showDeleteRolePanel}
        onOpenChange={(open) => {
          setShowDeleteRolePanel(open)
          if (!open) {
            setRoleToDelete(null)
            setDeleteRoleConfirmText("")
          }
        }}
        title="Delete profession role"
        description="This action is permanent and cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteRolePanel(false)} disabled={roleDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRole}
              disabled={roleDeleting || deleteRoleConfirmText !== "DELETE" || !roleToDelete}
            >
              Delete role
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Role</div>
            <div className="text-muted-foreground text-sm">{roleToDelete?.name || "—"}</div>
          </div>

          <div className="text-muted-foreground text-sm">
            If users are assigned to this role or role questions exist, deletion will be blocked. Reassign users and
            remove role questions before deleting.
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete_role_confirm">Type DELETE to confirm</Label>
            <Input
              id="delete_role_confirm"
              value={deleteRoleConfirmText}
              onChange={(e) => setDeleteRoleConfirmText(e.target.value)}
              disabled={roleDeleting}
            />
          </div>
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        title="Assign members to role"
        description="Select members from this department and assign them to a profession role."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={assignSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignmentClick}
              disabled={assignSaving || !selectedRoleId || selectedUserIds.size === 0}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Members</div>
              <div className="text-muted-foreground text-xs">{selectedUserIds.size} selected</div>
            </div>

            <div className="relative">
              <Input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Filter members by name or email"
                className={memberQuery ? "pr-8" : undefined}
              />
              {memberQuery && (
                <button
                  type="button"
                  onClick={() => setMemberQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-2 my-auto flex h-4 w-4 items-center justify-center rounded-full focus:outline-none"
                  aria-label="Clear member filter"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserIds(new Set(membersForPicker.map((m) => m.user_id)))}
                disabled={membersForPicker.length === 0}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserIds(new Set())}
                disabled={selectedUserIds.size === 0}
              >
                Clear
              </Button>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              {membershipsLoading ? (
                <div className="space-y-2 p-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                  ))}
                </div>
              ) : membersForPicker.length === 0 ? (
                <div className="text-muted-foreground p-3 text-sm">No members found.</div>
              ) : (
                <div className="divide-y">
                  {membersForPicker.map((m) => {
                    const checked = selectedUserIds.has(m.user_id)
                    const assignment = assignmentByUserId.get(m.user_id) || null
                    const assignedRoleName =
                      assignment?.role?.name || rolesById.get(assignment?.role_id || "")?.name || null
                    const showRoleBadge = !!assignment && assignedRoleName

                    return (
                      <label key={m.user_id} className="hover:bg-muted/40 flex items-start gap-3 p-3">
                        <div className="pt-0.5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v === true
                              setSelectedUserIds((prev) => {
                                const copy = new Set(prev)
                                if (next) copy.add(m.user_id)
                                else copy.delete(m.user_id)
                                return copy
                              })
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <div className="truncate text-sm font-medium">{m.name || "Unknown"}</div>
                            {showRoleBadge && (
                              <Badge variant={assignment?.is_active ? "secondary" : "outline"}>
                                {assignment?.is_active ? assignedRoleName : `${assignedRoleName} (inactive)`}
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-sm">{m.email || m.user_id}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
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
      </RightSidePanel>

      <RightSidePanel
        open={confirmBulkReassignOpen}
        onOpenChange={(open) => {
          setConfirmBulkReassignOpen(open)
          if (!open) setPendingBulkReassign(null)
        }}
        title="Reassign members to a different role?"
        description={(() => {
          if (!pendingBulkReassign) return "Some selected members already have a different profession role."
          const roleName = rolesById.get(pendingBulkReassign.toRoleId)?.name || pendingBulkReassign.toRoleId
          const count = pendingBulkReassign.userIds.filter((id) => {
            const existing = assignmentByUserId.get(id)
            return !!existing && existing.role_id !== pendingBulkReassign.toRoleId
          }).length
          return `${count} selected member${count === 1 ? "" : "s"} already ${count === 1 ? "has" : "have"} a different profession role. Continuing will move them to “${roleName}”.`
        })()}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmBulkReassignOpen(false)
                setPendingBulkReassign(null)
              }}
              disabled={assignSaving}
            >
              Cancel
            </Button>
            <Button
              disabled={assignSaving || !pendingBulkReassign}
              onClick={() => {
                if (!pendingBulkReassign) return
                setConfirmBulkReassignOpen(false)
                const ids = pendingBulkReassign.userIds
                const roleId = pendingBulkReassign.toRoleId
                setPendingBulkReassign(null)
                saveAssignmentsBulk(ids, roleId)
              }}
            >
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-4">
          {(() => {
            if (!pendingBulkReassign) return null

            const toRoleName = rolesById.get(pendingBulkReassign.toRoleId)?.name || pendingBulkReassign.toRoleId

            const affected = pendingBulkReassign.userIds
              .map((id) => {
                const existing = assignmentByUserId.get(id)
                if (!existing) return null
                if (existing.role_id === pendingBulkReassign.toRoleId) return null

                const member = memberships.find((m) => m.user_id === id)
                const displayName = member?.user?.name || member?.user?.email || id
                const email = member?.user?.email || null

                const fromRoleName = rolesById.get(existing.role_id)?.name || existing.role?.name || existing.role_id

                return {
                  userId: id,
                  displayName,
                  email,
                  fromRoleName,
                }
              })
              .filter(Boolean) as Array<{
              userId: string
              displayName: string
              email: string | null
              fromRoleName: string
            }>

            if (affected.length === 0) return null

            return (
              <div className="space-y-2">
                <div className="text-sm font-medium">New reassignments</div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  {affected.map((a) => (
                    <div
                      key={a.userId}
                      className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.displayName}</div>
                        <div className="text-muted-foreground truncate text-xs">{a.email || a.userId}</div>
                      </div>
                      <div className="text-muted-foreground shrink-0 text-right text-xs">
                        <div className="whitespace-nowrap">
                          {a.fromRoleName} -&gt; {toRoleName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={showAssignmentDeletePanel}
        onOpenChange={(open) => {
          setShowAssignmentDeletePanel(open)
          if (!open) {
            setAssignmentToRemove(null)
            setHardDeleteConfirmText("")
            setAssignmentDeletePanelMode("deactivate")
          }
        }}
        title={
          assignmentDeletePanelMode === "hard_delete"
            ? "Permanently delete assignment"
            : assignmentToRemove?.is_active
              ? "Deactivate assignment"
              : "Delete assignment"
        }
        description={
          assignmentDeletePanelMode === "hard_delete"
            ? "This action is permanent and cannot be undone."
            : "The user will lose access to this role, but history will be preserved."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAssignmentDeletePanel(false)} disabled={!!removingUserId}>
              Cancel
            </Button>
            {assignmentDeletePanelMode === "hard_delete" && (
              <Button
                variant="destructive"
                onClick={hardDeleteAssignment}
                disabled={!!removingUserId || !assignmentToRemove || hardDeleteConfirmText !== "DELETE"}
              >
                Permanently delete
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">User</div>
            <div className="text-muted-foreground text-sm">
              {assignmentToRemove?.user?.name || assignmentToRemove?.user?.email || assignmentToRemove?.user_id || "—"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Role</div>
            <div className="text-muted-foreground text-sm">
              {assignmentToRemove?.role?.name || rolesById.get(assignmentToRemove?.role_id || "")?.name || "—"}
            </div>
          </div>

          {assignmentDeletePanelMode === "deactivate" && assignmentToRemove?.is_active && (
            <div className="space-y-3">
              <div className="border-primary/30 bg-primary/5 space-y-2 rounded-md border p-3">
                <div className="text-primary text-sm font-medium">Deactivate</div>
                <div className="text-muted-foreground text-sm">
                  Deactivating preserves history. The user will no longer have access to this role.
                </div>
                <Button
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10"
                  disabled={!!removingUserId}
                  onClick={removeAssignment}
                >
                  Deactivate
                </Button>
              </div>

              <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-md border p-3">
                <div className="text-destructive text-sm font-medium">Danger zone</div>
                <div className="text-muted-foreground text-sm">
                  Permanently delete removes this assignment completely. This cannot be undone.
                </div>
                <Button
                  variant="destructive"
                  disabled={!!removingUserId}
                  onClick={() => {
                    setHardDeleteConfirmText("")
                    setAssignmentDeletePanelMode("hard_delete")
                  }}
                >
                  Permanently delete
                </Button>
              </div>
            </div>
          )}

          {assignmentDeletePanelMode === "hard_delete" && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm">Type DELETE to confirm.</div>
              <Input value={hardDeleteConfirmText} onChange={(e) => setHardDeleteConfirmText(e.target.value)} />
            </div>
          )}
        </div>
      </RightSidePanel>
    </div>
  )
}
