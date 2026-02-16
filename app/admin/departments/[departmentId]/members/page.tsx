"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { MoreVertical, Pencil, Search, Trash2, UserCheck, UserX } from "lucide-react"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import useSWR from "swr"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"

type DepartmentRoleRow = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
}

type DepartmentAccessLevel = {
  id: string
  name: string
  display_name: string
  description?: string
  level: number
  is_active: boolean
}

type SearchUser = {
  user_id: string
  email: string | null
  name: string | null
}

type MembershipRow = {
  id: string
  user_id: string
  department_id: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  user: {
    user_id: string
    email: string | null
    name: string | null
  }
}

type AllMembershipRow = {
  user_id: string | null
  department_id: string | null
  role: string | null
  is_active: boolean
  user: {
    user_id: string | null
    email: string | null
    name: string | null
  }
  department: {
    id: string | null
    name: string | null
    is_active: boolean | null
  }
}

export function DepartmentMembersPanel({ departmentId }: { departmentId: string | null }) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const membershipsKey = canAccessAdmin && departmentId ? `/api/admin/departments/${departmentId}/memberships` : null

  const deptRolesKey = canAccessAdmin ? "/api/admin/department-roles" : null
  const { data: deptRolesResponse, isLoading: deptRolesLoading } = useSWR<{ data: DepartmentRoleRow[] }>(deptRolesKey)

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: isMembershipsLoading,
    mutate: mutateMemberships,
  } = useSWR<{ data: MembershipRow[] }>(membershipsKey)

  const loading = isMembershipsLoading

  const allMembershipsKey = canAccessAdmin && !departmentId ? `/api/admin/users/memberships?format=enriched` : null
  const {
    data: allMembershipsResponse,
    error: allMembershipsError,
    isLoading: isAllMembershipsLoading,
  } = useSWR<{ data: AllMembershipRow[] }>(allMembershipsKey)

  const memberships = useMemo(() => {
    return Array.isArray(membershipsResponse?.data) ? (membershipsResponse?.data ?? []) : []
  }, [membershipsResponse])

  const departmentRoles = useMemo(() => {
    const rows: DepartmentRoleRow[] = deptRolesResponse?.data ?? []
    return rows.filter((r) => r.is_active)
  }, [deptRolesResponse])

  const defaultDepartmentRoleKey = useMemo(() => {
    if (departmentRoles.length === 0) return ""
    return departmentRoles.find((r) => r.is_default)?.key || departmentRoles[0].key
  }, [departmentRoles])

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [editingMembershipUserId, setEditingMembershipUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [originalDepartmentRoleKey, setOriginalDepartmentRoleKey] = useState<string>("")
  const [selectedAccessLevelId, setSelectedAccessLevelId] = useState<string>("")
  const [accessLevels, setAccessLevels] = useState<DepartmentAccessLevel[]>([])
  const [loadingAccessLevels, setLoadingAccessLevels] = useState(true)
  const [selectedActive, setSelectedActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingActiveMembership, setCheckingActiveMembership] = useState(false)
  const [activeMembershipElsewhere, setActiveMembershipElsewhere] = useState<{
    department_id: string
    department_name: string | null
  } | null>(null)
  const [assignPanelMode, setAssignPanelMode] = useState<"form" | "confirm_move" | "confirm_department_role_change">(
    "form"
  )
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [memberToDeactivate, setMemberToDeactivate] = useState<MembershipRow | null>(null)
  const [memberToHardDelete, setMemberToHardDelete] = useState<MembershipRow | null>(null)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const lastMembershipsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    const assignRole = searchParams.get("assignRole")
    if (!assignRole) return
    if (!departmentId) return
    if (!canAccessAdmin) return
    if (deptRolesLoading) return
    if (departmentRoles.length === 0) return

    const roleKeyToUse = departmentRoles.some((r) => r.key === assignRole) ? assignRole : defaultDepartmentRoleKey

    setShowAssignDialog(true)
    setSelectedRole(roleKeyToUse)
    setOriginalDepartmentRoleKey(roleKeyToUse)
    setSelectedActive(true)

    setSelectedUser(null)
    setSelectedUserId(null)
    setEditingMembershipUserId(null)
    setUserQuery("")
    setSearchResults([])
    setAssignPanelMode("form")

    const next = new URLSearchParams(searchParams.toString())
    next.delete("assignRole")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [
    canAccessAdmin,
    defaultDepartmentRoleKey,
    departmentId,
    departmentRoles,
    deptRolesLoading,
    pathname,
    router,
    searchParams,
  ])

  useEffect(() => {
    if (!membershipsError) return
    const message = getErrorMessage(membershipsError, "Failed to load members")
    if (message === lastMembershipsErrorRef.current) return
    lastMembershipsErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [membershipsError, toast])

  useEffect(() => {
    if (!allMembershipsError) return
    const message = getErrorMessage(allMembershipsError, "Failed to load members")
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [allMembershipsError, toast])

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (!canAccessAdmin) {
      router.push("/")
    }
  }, [user, canAccessAdmin, isLoading, router, rbacChecked, rbacLoading])

  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (!rbacChecked || rbacLoading) return
    if (!canAccessAdmin) return
    if (!departmentId) return
  }, [isLoading, user, rbacChecked, rbacLoading, canAccessAdmin, departmentId])

  const hardDeleteMember = async () => {
    if (!memberToHardDelete) return
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse

    try {
      setRemovingUserId(memberToHardDelete.user_id)

      mutateMemberships(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return { data: rows.filter((m) => m.user_id !== memberToHardDelete.user_id) }
        },
        { revalidate: false }
      )

      await apiFetch<{ data: { deleted: boolean } | null }>(
        `/api/admin/departments/${departmentId}/memberships/${memberToHardDelete.user_id}?mode=hard`,
        { method: "DELETE" }
      )

      toast({
        title: "Deleted",
        description: "Membership permanently deleted",
      })

      setMemberToHardDelete(null)
      setHardDeleteConfirmText("")
    } catch (error: unknown) {
      if (prevMembershipsResponse) {
        mutateMemberships(prevMembershipsResponse, { revalidate: false })
      } else {
        mutateMemberships()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to permanently delete membership"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
    }
  }

  const confirmDeactivateMember = (m: MembershipRow) => {
    setMemberToDeactivate(m)
  }

  const activateMember = async (m: MembershipRow) => {
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse

    try {
      setRemovingUserId(m.user_id)
      const nowIso = new Date().toISOString()
      const restoredUserId = m.user_id
      const restoredDisplayName = m.user?.name || m.user?.email || restoredUserId

      mutateMemberships(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return {
            data: rows.map((row) =>
              row.user_id === restoredUserId ? { ...row, is_active: true, updated_at: nowIso } : row
            ),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{
        data: {
          id: string
          user_id: string
          department_id: string
          role: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }>(`/api/admin/departments/${departmentId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: restoredUserId,
          is_active: true,
        }),
      })

      toast({
        title: "Activated",
        description: `${restoredDisplayName} activated in this department`,
      })
    } catch (error: unknown) {
      if (prevMembershipsResponse) {
        mutateMemberships(prevMembershipsResponse, { revalidate: false })
      } else {
        mutateMemberships()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to activate member"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
    }
  }

  const deactivateMember = async () => {
    if (!memberToDeactivate) return
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse

    try {
      setRemovingUserId(memberToDeactivate.user_id)
      const nowIso = new Date().toISOString()
      const removedUserId = memberToDeactivate.user_id
      const removedDisplayName = memberToDeactivate.user?.name || memberToDeactivate.user?.email || removedUserId

      mutateMemberships(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return {
            data: rows.map((m) => (m.user_id === removedUserId ? { ...m, is_active: false, updated_at: nowIso } : m)),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{ data: unknown }>(
        `/api/admin/departments/${departmentId}/memberships/${memberToDeactivate.user_id}`,
        { method: "DELETE" }
      )

      toast({
        title: "Deactivated",
        description: `${removedDisplayName} deactivated in this department`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              const prevUndoMembershipsResponse = membershipsResponse
              try {
                const nowIso = new Date().toISOString()

                mutateMemberships(
                  (current) => {
                    if (!current) return current
                    const rows = Array.isArray(current?.data) ? current.data : []
                    return {
                      data: rows.map((m) =>
                        m.user_id === removedUserId ? { ...m, is_active: true, updated_at: nowIso } : m
                      ),
                    }
                  },
                  { revalidate: false }
                )

                await apiFetch<{
                  data: {
                    id: string
                    user_id: string
                    department_id: string
                    role: string
                    is_active: boolean
                    created_at: string
                    updated_at: string
                  }
                }>(`/api/admin/departments/${departmentId}/memberships`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: removedUserId,
                    is_active: true,
                  }),
                })
                toast({ title: "Restored", description: "Membership restored" })
              } catch (e: unknown) {
                if (prevUndoMembershipsResponse) {
                  mutateMemberships(prevUndoMembershipsResponse, { revalidate: false })
                } else {
                  mutateMemberships()
                }

                toast({
                  title: "Error",
                  description: getErrorMessage(e, "Failed to undo"),
                  variant: "destructive",
                })
              } finally {
                mutateMemberships()
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      })

      setMemberToDeactivate(null)
    } catch (error: unknown) {
      if (prevMembershipsResponse) {
        mutateMemberships(prevMembershipsResponse, { revalidate: false })
      } else {
        mutateMemberships()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to deactivate member"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
    }
  }

  const people = useMemo(() => {
    const all = [...memberships].sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id
      const bn = b.user?.name || b.user?.email || b.user_id
      return an.localeCompare(bn)
    })

    if (!searchQuery.trim()) return all
    const q = searchQuery.toLowerCase()
    return all.filter((m) => {
      const name = (m.user?.name || "").toLowerCase()
      const email = (m.user?.email || "").toLowerCase()
      const role = m.role.toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q)
    })
  }, [memberships, searchQuery])

  useEffect(() => {
    if (!showAssignDialog) return
    if (!defaultDepartmentRoleKey) return
    if (selectedRole) return
    setSelectedRole(defaultDepartmentRoleKey)
  }, [defaultDepartmentRoleKey, selectedRole, showAssignDialog])

  const openAssign = useCallback(() => {
    setShowAssignDialog(true)
    setUserQuery("")
    setSearchResults([])
    setSelectedUser(null)
    setSelectedUserId(null)
    setEditingMembershipUserId(null)
    setSelectedRole(defaultDepartmentRoleKey)
    setOriginalDepartmentRoleKey(defaultDepartmentRoleKey)
    setSelectedActive(true)
    setCheckingActiveMembership(false)
    setActiveMembershipElsewhere(null)
    setAssignPanelMode("form")
  }, [defaultDepartmentRoleKey])

  useEffect(() => {
    const shouldOpen = searchParams.get("assign") === "1"
    if (!shouldOpen) return
    if (showAssignDialog) return

    openAssign()

    // Clean up the assign parameter from URL
    const next = new URLSearchParams(searchParams.toString())
    next.delete("assign")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [openAssign, pathname, router, searchParams, showAssignDialog])

  useEffect(() => {
    if (showAssignDialog) return
    setEditingMembershipUserId(null)
    setAssignPanelMode("form")
    setOriginalDepartmentRoleKey("")
  }, [showAssignDialog])

  useEffect(() => {
    if (!showAssignDialog) return
    if (!departmentId) return
    if (!selectedUserId) {
      setActiveMembershipElsewhere(null)
      return
    }
    if (!selectedActive) {
      setActiveMembershipElsewhere(null)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        setCheckingActiveMembership(true)
        const json = await apiFetch<{
          data: Array<{ department_id: string | null; department?: { name: string | null } }>
        }>(`/api/admin/users/memberships?format=enriched&user_id=${encodeURIComponent(selectedUserId)}`)

        if (cancelled) return
        const rows = Array.isArray(json?.data) ? json.data : []
        const other = rows.find((r) => !!r?.department_id && r.department_id !== departmentId)
        if (other?.department_id) {
          setActiveMembershipElsewhere({
            department_id: other.department_id,
            department_name: other.department?.name ?? null,
          })
        } else {
          setActiveMembershipElsewhere(null)
        }
      } catch {
        if (cancelled) return
        setActiveMembershipElsewhere(null)
      } finally {
        if (!cancelled) setCheckingActiveMembership(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [departmentId, selectedActive, selectedUserId, showAssignDialog])

  const userSearchAbortRef = useRef<AbortController | null>(null)
  const userSearchRequestIdRef = useRef(0)

  const runUserSearch = async (query: string) => {
    const q = query.trim()
    if (!q) return

    userSearchAbortRef.current?.abort()
    const controller = new AbortController()
    userSearchAbortRef.current = controller
    const requestId = ++userSearchRequestIdRef.current

    try {
      setSearchLoading(true)
      const json = await apiFetch<{ data: SearchUser[] }>(`/api/admin/users/search?query=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })

      if (requestId !== userSearchRequestIdRef.current) return
      setSearchResults((json.data || []) as SearchUser[])
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to search users"),
        variant: "destructive",
      })
    } finally {
      if (requestId === userSearchRequestIdRef.current) {
        setSearchLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!showAssignDialog) return
    const q = userQuery.trim()

    if (!q) {
      userSearchAbortRef.current?.abort()
      setSearchLoading(false)
      setSearchResults([])
      return
    }

    const handle = setTimeout(() => {
      runUserSearch(q)
    }, 300)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery, showAssignDialog])

  // Fetch access levels for dropdown
  useEffect(() => {
    const fetchAccessLevels = async () => {
      try {
        const response = await apiFetch<{ data: DepartmentAccessLevel[] }>("/api/admin/department-access-levels")
        if (response.data) {
          setAccessLevels(response.data.filter((al) => al.is_active))
        }
      } catch {
        // ignore
      } finally {
        setLoadingAccessLevels(false)
      }
    }
    fetchAccessLevels()
  }, [])

  // Preselect access level when editing
  useEffect(() => {
    if (!showAssignDialog) return
    if (!editingMembershipUserId) return
    if (!departmentId) return
    if (!accessLevels.length) return
    // TODO: fetch current assignment; for now keep empty
  }, [showAssignDialog, editingMembershipUserId, departmentId, accessLevels])

  const saveMembership = async () => {
    if (!selectedUserId) {
      toast({
        title: "Missing user",
        description: "Select a user to assign",
        variant: "destructive",
      })
      return
    }

    if (!departmentId) {
      toast({
        title: "Missing department",
        description: "Select a department to edit memberships.",
        variant: "destructive",
      })
      return
    }

    const deptId = departmentId

    const prevMembershipsResponse = membershipsResponse

    try {
      const nowIso = new Date().toISOString()
      const existingMembership = memberships.find((m) => m.user_id === selectedUserId)
      const isEditing = !!existingMembership
      const moveFrom = selectedActive ? activeMembershipElsewhere : null

      const optimisticMembership: MembershipRow = existingMembership
        ? {
            ...existingMembership,
            role: selectedRole,
            is_active: selectedActive,
            updated_at: nowIso,
          }
        : {
            id: `temp-${selectedUserId}`,
            user_id: selectedUserId,
            department_id: deptId,
            role: selectedRole,
            is_active: selectedActive,
            created_at: nowIso,
            updated_at: nowIso,
            user: {
              user_id: selectedUserId,
              email: selectedUser?.email || null,
              name: selectedUser?.name || null,
            },
          }

      mutateMemberships(
        (current) => {
          if (!current) return current
          const prev = Array.isArray(current?.data) ? current.data : []
          const without = prev.filter((m) => m.user_id !== selectedUserId)
          return { data: [optimisticMembership, ...without] }
        },
        { revalidate: false }
      )

      setSaving(true)
      const json = await apiFetch<{
        data:
          | {
              id: string
              user_id: string
              department_id: string
              role: string
              is_active: boolean
              created_at: string
              updated_at: string
            }
          | undefined
      }>(`/api/admin/departments/${deptId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
          is_active: selectedActive,
        }),
      })

      const savedMembership = json?.data

      if (savedMembership?.id) {
        mutateMemberships(
          (current) => {
            if (!current) return current
            const prev = Array.isArray(current?.data) ? current.data : []
            return {
              data: prev.map((m) =>
                m.user_id === selectedUserId
                  ? {
                      ...m,
                      id: savedMembership.id,
                      role: savedMembership.role,
                      is_active: savedMembership.is_active,
                      created_at: savedMembership.created_at,
                      updated_at: savedMembership.updated_at,
                    }
                  : m
              ),
            }
          },
          { revalidate: false }
        )
      }

      // Save access level assignment if selected
      if (selectedAccessLevelId) {
        try {
          await apiFetch(`/api/admin/users/${selectedUserId}/department-access-levels`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              department_id: departmentId,
              access_level_id: selectedAccessLevelId,
            }),
          })
        } catch {
          // ignore access-level errors for now
        }
      }

      const moveFromLabel = moveFrom ? moveFrom.department_name || moveFrom.department_id : null

      const roleLabelByKey = new Map(departmentRoles.map((r) => [r.key, r.label]))
      const prevRoleLabel = existingMembership
        ? roleLabelByKey.get(existingMembership.role) || existingMembership.role
        : null
      const nextRoleLabel = roleLabelByKey.get(selectedRole) || selectedRole

      const changes: string[] = []
      if (isEditing && existingMembership) {
        if (existingMembership.role !== selectedRole) {
          changes.push(`Department role: ${prevRoleLabel} → ${nextRoleLabel}`)
        }
        if (existingMembership.is_active !== selectedActive) {
          changes.push(
            `Member: ${existingMembership.is_active ? "Active" : "Inactive"} → ${selectedActive ? "Active" : "Inactive"}`
          )
        }
      }

      toast({
        title: moveFrom ? "Moved" : isEditing ? "Changes saved" : "Assigned",
        description: moveFrom
          ? `Activated in this department and deactivated in “${moveFromLabel}”.`
          : isEditing
            ? changes.length
              ? changes.join(" • ")
              : "Changes saved"
            : "Member assigned",
      })
      setShowAssignDialog(false)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        if (prevMembershipsResponse) {
          mutateMemberships(prevMembershipsResponse, { revalidate: false })
        } else {
          mutateMemberships()
        }

        toast({
          title: "Cannot activate membership",
          description: getErrorMessage(error, "User already has an active department membership"),
          variant: "destructive",
        })
        return
      }
      if (prevMembershipsResponse) {
        mutateMemberships(prevMembershipsResponse, { revalidate: false })
      } else {
        mutateMemberships()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save membership"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      mutateMemberships()
    }
  }

  const handleSaveClick = () => {
    const isEditing = !!editingMembershipUserId
    const departmentRoleChanged = isEditing && !!originalDepartmentRoleKey && selectedRole !== originalDepartmentRoleKey

    if (!selectedActive || !activeMembershipElsewhere) {
      if (departmentRoleChanged) {
        setAssignPanelMode("confirm_department_role_change")
        return
      }
      saveMembership()
      return
    }

    setAssignPanelMode("confirm_move")
  }

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
        <Skeleton className="h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!departmentId) {
    const allMemberships = Array.isArray(allMembershipsResponse?.data) ? (allMembershipsResponse?.data ?? []) : []
    const rows = [...allMemberships].sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id || ""
      const bn = b.user?.name || b.user?.email || b.user_id || ""
      if (an !== bn) return an.localeCompare(bn)
      const ad = a.department?.name || a.department_id || ""
      const bd = b.department?.name || b.department_id || ""
      return ad.localeCompare(bd)
    })

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>All department memberships.</CardDescription>
          </CardHeader>
          <CardContent>
            {isAllMembershipsLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-muted-foreground text-sm">No people yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => {
                      const name = m.user?.name || "Unknown"
                      const email = m.user?.email || m.user_id || ""
                      const dept = m.department?.name || m.department_id || ""
                      return (
                        <TableRow key={`${m.user_id ?? "unknown"}-${m.department_id ?? "unknown"}`}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell className="text-muted-foreground">{email}</TableCell>
                          <TableCell>{dept}</TableCell>
                          <TableCell>{m.role ? <Badge variant="secondary">{m.role}</Badge> : "-"}</TableCell>
                          <TableCell>
                            {m.is_active ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="border-dashed">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (rbacChecked && !canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
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
      <div className="dark:bg-background rounded-lg border border-gray-200 bg-white dark:border-gray-700">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {people.length} {people.length === 1 ? "member" : "members"}
            </div>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                type="text"
                placeholder="Search members..."
                className="h-9 w-64 border-gray-200 bg-gray-50 pl-9 dark:border-gray-600 dark:bg-gray-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Name
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Role
                </TableHead>
                <TableHead className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                    </TableCell>
                  </TableRow>
                ))
              ) : people.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-8 text-center text-sm">
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                people.map((m) => (
                  <TableRow key={m.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {(m.user?.name || "U")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div
                            className={`font-medium text-gray-900 dark:text-gray-100 ${!m.is_active ? "line-through" : ""}`}
                          >
                            {m.user?.name || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{m.user?.email || m.user_id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={m.is_active ? "secondary" : "outline"}>{m.role}</Badge>
                        {!m.is_active && (
                          <Badge variant="outline" className="border-dashed">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <ActionMenu
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!!removingUserId && removingUserId === m.user_id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                        items={
                          [
                            {
                              type: "label",
                              label: m.user?.name || m.user?.email || "Member",
                            },
                            { type: "separator" },
                            {
                              type: "item",
                              label: "Edit",
                              icon: <Pencil className="mr-2 h-4 w-4" />,
                              onSelect: () => {
                                setShowAssignDialog(true)
                                setSelectedUserId(m.user_id)
                                setEditingMembershipUserId(m.user_id)
                                setSelectedRole(m.role)
                                setOriginalDepartmentRoleKey(m.role)
                                setSelectedActive(m.is_active)
                                setUserQuery(m.user?.email || m.user?.name || "")
                                setSearchResults([])
                                setAssignPanelMode("form")
                              },
                            },
                            m.is_active
                              ? {
                                  type: "item",
                                  label: "Deactivate",
                                  icon: <UserX className="mr-2 h-4 w-4" />,
                                  destructive: true,
                                  onSelect: () => confirmDeactivateMember(m),
                                }
                              : {
                                  type: "item",
                                  label: "Activate",
                                  icon: <UserCheck className="mr-2 h-4 w-4" />,
                                  onSelect: () => activateMember(m),
                                },
                            { type: "separator" },
                            {
                              type: "item",
                              label: "Permanently delete",
                              icon: <Trash2 className="mr-2 h-4 w-4" />,
                              destructive: true,
                              onSelect: () => {
                                setMemberToHardDelete(m)
                                setHardDeleteConfirmText("")
                              },
                            },
                          ] satisfies ActionMenuItem[]
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RightSidePanel
        open={!!memberToDeactivate}
        onOpenChange={(open) => {
          if (!open) setMemberToDeactivate(null)
        }}
        title="Deactivate member"
        description="This will deactivate access to this department. You can re-enable later."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMemberToDeactivate(null)} disabled={!!removingUserId}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={!!removingUserId}
              onClick={() => {
                if (!memberToDeactivate) return
                setMemberToHardDelete(memberToDeactivate)
                setMemberToDeactivate(null)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Permanently delete
            </Button>
            <Button variant="default" disabled={!!removingUserId} onClick={deactivateMember}>
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="bg-muted/20 rounded-md border p-4">
            <div className="text-sm font-semibold">
              {memberToDeactivate?.user?.name ||
                memberToDeactivate?.user?.email ||
                memberToDeactivate?.user_id ||
                "Member"}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {memberToDeactivate?.user?.email || memberToDeactivate?.user_id || ""}
            </div>
          </div>
          <div className="text-muted-foreground text-xs">Deactivating does not delete history; it removes access.</div>
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={!!memberToHardDelete}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToHardDelete(null)
            setHardDeleteConfirmText("")
          }
        }}
        title="Permanently delete membership"
        description="This cannot be undone. Type DELETE to confirm."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMemberToHardDelete(null)
                setHardDeleteConfirmText("")
              }}
              disabled={!!removingUserId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={hardDeleteMember}
              disabled={!!removingUserId || hardDeleteConfirmText !== "DELETE"}
            >
              Permanently delete
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="bg-muted/20 rounded-md border border-red-500/40 p-4">
            <div className="text-sm font-semibold">
              {memberToHardDelete?.user?.name ||
                memberToHardDelete?.user?.email ||
                memberToHardDelete?.user_id ||
                "Member"}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {memberToHardDelete?.user?.email || memberToHardDelete?.user_id || ""}
            </div>
          </div>

          <div className="space-y-2">
            <Input value={hardDeleteConfirmText} onChange={(e) => setHardDeleteConfirmText(e.target.value)} />
          </div>
        </div>
      </RightSidePanel>
    </div>
  )
}

export default function AdminDepartmentMembersPage() {
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const pathname = usePathname()
  const departmentId = params.departmentId

  useEffect(() => {
    if (!departmentId) return

    if (pathname.endsWith(`/admin/departments/${departmentId}/members`)) {
      router.replace(`/admin/departments/${departmentId}?tab=members`)
    }
  }, [pathname, router, departmentId])

  return <DepartmentMembersPanel departmentId={departmentId} />
}
