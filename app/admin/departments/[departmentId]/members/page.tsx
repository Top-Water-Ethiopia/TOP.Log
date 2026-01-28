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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { MoreVertical, Pencil, Search, Trash2, UserX, X as XIcon } from "lucide-react"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

type SearchUser = {
  user_id: string
  email: string | null
  name: string | null
}

type ProfessionRoleRow = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  level?: number
}

type ProfessionAssignmentRow = {
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
  const professionRolesKey =
    canAccessAdmin && departmentId ? `/api/admin/departments/${departmentId}/profession-roles` : null
  const professionAssignmentsKey =
    canAccessAdmin && departmentId ? `/api/admin/departments/${departmentId}/profession-assignments` : null

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: isMembershipsLoading,
    mutate: mutateMemberships,
  } = useSWR<{ data: MembershipRow[] }>(membershipsKey)

  const {
    data: professionRolesResponse,
    error: professionRolesError,
    isLoading: isProfessionRolesLoading,
  } = useSWR<{ data: ProfessionRoleRow[] }>(professionRolesKey)

  const {
    data: professionAssignmentsResponse,
    error: professionAssignmentsError,
    isLoading: isProfessionAssignmentsLoading,
    mutate: mutateProfessionAssignments,
  } = useSWR<{ data: ProfessionAssignmentRow[] }>(professionAssignmentsKey)

  const loading = isMembershipsLoading || isProfessionAssignmentsLoading
  const professionRolesLoading = isProfessionRolesLoading

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

  const implicitDepartmentRoleKey = useMemo(() => {
    if (departmentRoles.length === 0) return defaultDepartmentRoleKey
    return departmentRoles[departmentRoles.length - 1]?.key || defaultDepartmentRoleKey
  }, [defaultDepartmentRoleKey, departmentRoles])

  const professionRoles = useMemo(() => {
    return Array.isArray(professionRolesResponse?.data) ? (professionRolesResponse?.data ?? []) : []
  }, [professionRolesResponse])

  const professionAssignments = useMemo(() => {
    return Array.isArray(professionAssignmentsResponse?.data) ? (professionAssignmentsResponse?.data ?? []) : []
  }, [professionAssignmentsResponse])

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [editingMembershipUserId, setEditingMembershipUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [originalDepartmentRoleKey, setOriginalDepartmentRoleKey] = useState<string>("")
  const [selectedActive, setSelectedActive] = useState(true)
  const PROFESSION_ROLE_NONE = "__none__"
  const [selectedProfessionRoleId, setSelectedProfessionRoleId] = useState<string>(PROFESSION_ROLE_NONE)
  const [selectedProfessionActive, setSelectedProfessionActive] = useState(true)
  const [originalProfessionRoleId, setOriginalProfessionRoleId] = useState<string>(PROFESSION_ROLE_NONE)
  const [originalProfessionActive, setOriginalProfessionActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingActiveMembership, setCheckingActiveMembership] = useState(false)
  const [activeMembershipElsewhere, setActiveMembershipElsewhere] = useState<{
    department_id: string
    department_name: string | null
  } | null>(null)
  const [assignPanelMode, setAssignPanelMode] = useState<
    "form" | "confirm_move" | "confirm_department_role_change" | "confirm_profession_change"
  >("form")
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [memberToDeactivate, setMemberToDeactivate] = useState<MembershipRow | null>(null)
  const [memberToHardDelete, setMemberToHardDelete] = useState<MembershipRow | null>(null)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const lastMembershipsErrorRef = useRef<string | null>(null)
  const lastProfessionRolesErrorRef = useRef<string | null>(null)
  const lastProfessionAssignmentsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!membershipsError) return
    const message = getErrorMessage(membershipsError, "Failed to load members")
    if (message === lastMembershipsErrorRef.current) return
    lastMembershipsErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [membershipsError, toast])

  useEffect(() => {
    if (!professionRolesError) return
    const message = getErrorMessage(professionRolesError, "Failed to load profession roles")
    if (message === lastProfessionRolesErrorRef.current) return
    lastProfessionRolesErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [professionRolesError, toast])

  useEffect(() => {
    if (!professionAssignmentsError) return
    const message = getErrorMessage(professionAssignmentsError, "Failed to load profession assignments")
    if (message === lastProfessionAssignmentsErrorRef.current) return
    lastProfessionAssignmentsErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [professionAssignmentsError, toast])

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
    const prevProfessionAssignmentsResponse = professionAssignmentsResponse

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

      mutateProfessionAssignments(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return { data: rows.filter((a) => a.user_id !== memberToHardDelete.user_id) }
        },
        { revalidate: false }
      )

      const json = await apiFetch<{ data: { deleted: boolean } | null }>(
        `/api/admin/departments/${departmentId}/memberships/${memberToHardDelete.user_id}?mode=hard`,
        { method: "DELETE" }
      )

      if (!json?.data) {
        await apiFetch<{ data: unknown }>(
          `/api/admin/departments/${departmentId}/profession-assignments/${memberToHardDelete.user_id}?mode=hard`,
          { method: "DELETE" }
        )
      }

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

      if (prevProfessionAssignmentsResponse) {
        mutateProfessionAssignments(prevProfessionAssignmentsResponse, { revalidate: false })
      } else {
        mutateProfessionAssignments()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to permanently delete membership"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
      mutateProfessionAssignments()
    }
  }

  const confirmDeactivateMember = (m: MembershipRow) => {
    setMemberToDeactivate(m)
  }

  const deactivateMember = async () => {
    if (!memberToDeactivate) return
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse
    const prevProfessionAssignmentsResponse = professionAssignmentsResponse

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

      mutateProfessionAssignments(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return {
            data: rows.map((a) => (a.user_id === removedUserId ? { ...a, is_active: false, updated_at: nowIso } : a)),
          }
        },
        { revalidate: false }
      )

      const json = await apiFetch<{ data: unknown }>(
        `/api/admin/departments/${departmentId}/memberships/${memberToDeactivate.user_id}`,
        { method: "DELETE" }
      )

      if (!json?.data) {
        await apiFetch<{ data: unknown }>(
          `/api/admin/departments/${departmentId}/profession-assignments/${memberToDeactivate.user_id}`,
          { method: "DELETE" }
        )
      }

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

      if (prevProfessionAssignmentsResponse) {
        mutateProfessionAssignments(prevProfessionAssignmentsResponse, { revalidate: false })
      } else {
        mutateProfessionAssignments()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to deactivate member"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
      mutateProfessionAssignments()
    }
  }

  const professionRolesById = useMemo(() => {
    return new Map(professionRoles.map((r) => [r.id, r]))
  }, [professionRoles])

  const professionAssignmentByUserId = useMemo(() => {
    return new Map(professionAssignments.map((a) => [a.user_id, a]))
  }, [professionAssignments])

  const people = useMemo(() => {
    const byUserId = new Map(memberships.map((m) => [m.user_id, m]))

    for (const a of professionAssignments) {
      if (byUserId.has(a.user_id)) continue

      byUserId.set(a.user_id, {
        id: `implicit-${a.user_id}`,
        user_id: a.user_id,
        department_id: a.department_id,
        role: implicitDepartmentRoleKey || defaultDepartmentRoleKey || "",
        is_active: a.is_active,
        created_at: a.created_at,
        updated_at: a.updated_at,
        user: {
          user_id: a.user_id,
          email: a.user?.email || null,
          name: a.user?.name || null,
        },
      })
    }

    const all = [...byUserId.values()].sort((a, b) => {
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
  }, [defaultDepartmentRoleKey, implicitDepartmentRoleKey, memberships, professionAssignments, searchQuery])

  useEffect(() => {
    if (!showAssignDialog) return
    if (!defaultDepartmentRoleKey) return
    if (selectedRole) return
    setSelectedRole(defaultDepartmentRoleKey)
  }, [defaultDepartmentRoleKey, selectedRole, showAssignDialog])

  useEffect(() => {
    if (!showAssignDialog) return
    if (selectedActive) return
    if (!selectedProfessionActive) return
    setSelectedProfessionActive(false)
  }, [selectedActive, selectedProfessionActive, showAssignDialog])

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
    setSelectedProfessionRoleId(PROFESSION_ROLE_NONE)
    setSelectedProfessionActive(true)
    setOriginalProfessionRoleId(PROFESSION_ROLE_NONE)
    setOriginalProfessionActive(true)
  }, [defaultDepartmentRoleKey])

  useEffect(() => {
    const shouldOpen = searchParams.get("assign") === "1"
    if (!shouldOpen) return
    if (showAssignDialog) return

    openAssign()
    router.replace(`${pathname}?tab=members`)
  }, [openAssign, pathname, router, searchParams, showAssignDialog])

  useEffect(() => {
    if (showAssignDialog) return
    setEditingMembershipUserId(null)
    setAssignPanelMode("form")
    setOriginalDepartmentRoleKey("")
    setOriginalProfessionRoleId(PROFESSION_ROLE_NONE)
    setOriginalProfessionActive(true)
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
    const prevProfessionAssignmentsResponse = professionAssignmentsResponse

    try {
      const nowIso = new Date().toISOString()
      const existingMembership = memberships.find((m) => m.user_id === selectedUserId)
      const isEditing = !!existingMembership
      const moveFrom = selectedActive ? activeMembershipElsewhere : null

      const effectiveProfessionActive = selectedActive ? selectedProfessionActive : false

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

      const effectiveProfessionRoleId =
        selectedProfessionRoleId !== PROFESSION_ROLE_NONE && !professionRolesById.has(selectedProfessionRoleId)
          ? PROFESSION_ROLE_NONE
          : selectedProfessionRoleId

      mutateProfessionAssignments(
        (current) => {
          if (!current) return current
          const prev = Array.isArray(current?.data) ? current.data : []
          if (effectiveProfessionRoleId === PROFESSION_ROLE_NONE) {
            return { data: prev.filter((a) => a.user_id !== selectedUserId) }
          }

          const existing = prev.find((a) => a.user_id === selectedUserId)
          const optimistic: ProfessionAssignmentRow = existing
            ? {
                ...existing,
                role_id: effectiveProfessionRoleId,
                is_active: effectiveProfessionActive,
                updated_at: nowIso,
              }
            : {
                id: `temp-pa-${selectedUserId}`,
                user_id: selectedUserId,
                department_id: deptId,
                role_id: effectiveProfessionRoleId,
                is_active: effectiveProfessionActive,
                created_at: nowIso,
                updated_at: nowIso,
                role: professionRolesById.get(effectiveProfessionRoleId) || null,
              }

          const without = prev.filter((a) => a.user_id !== selectedUserId)
          return { data: [optimistic, ...without] }
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

      if (effectiveProfessionRoleId === PROFESSION_ROLE_NONE) {
        await apiFetch<{ data: unknown }>(`/api/admin/departments/${deptId}/profession-assignments/${selectedUserId}`, {
          method: "DELETE",
        })
      } else {
        await apiFetch<{ data: unknown }>(`/api/admin/departments/${deptId}/profession-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            role_id: effectiveProfessionRoleId,
            is_active: effectiveProfessionActive,
          }),
        })
      }

      const moveFromLabel = moveFrom ? moveFrom.department_name || moveFrom.department_id : null

      const roleLabelByKey = new Map(departmentRoles.map((r) => [r.key, r.label]))
      const prevRoleLabel = existingMembership
        ? roleLabelByKey.get(existingMembership.role) || existingMembership.role
        : null
      const nextRoleLabel = roleLabelByKey.get(selectedRole) || selectedRole

      const existingProf = professionAssignments.find((a) => a.user_id === selectedUserId) || null
      const prevProfRoleName = existingProf
        ? professionRolesById.get(existingProf.role_id)?.name || existingProf.role_id
        : null
      const nextProfRoleName =
        effectiveProfessionRoleId !== PROFESSION_ROLE_NONE
          ? professionRolesById.get(effectiveProfessionRoleId)?.name || effectiveProfessionRoleId
          : null

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

      if (isEditing) {
        if (effectiveProfessionRoleId === PROFESSION_ROLE_NONE) {
          if (existingProf) changes.push("Profession role: removed")
        } else {
          if (!existingProf) {
            changes.push(`Profession role: ${nextProfRoleName}`)
          } else if (existingProf.role_id !== effectiveProfessionRoleId) {
            changes.push(`Profession role: ${prevProfRoleName} → ${nextProfRoleName}`)
          }

          if ((existingProf?.is_active ?? false) !== effectiveProfessionActive) {
            changes.push(
              `Profession role active: ${(existingProf?.is_active ?? false) ? "On" : "Off"} → ${effectiveProfessionActive ? "On" : "Off"}`
            )
          }
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

        if (prevProfessionAssignmentsResponse) {
          mutateProfessionAssignments(prevProfessionAssignmentsResponse, { revalidate: false })
        } else {
          mutateProfessionAssignments()
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

      if (prevProfessionAssignmentsResponse) {
        mutateProfessionAssignments(prevProfessionAssignmentsResponse, { revalidate: false })
      } else {
        mutateProfessionAssignments()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save membership"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      mutateMemberships()
      mutateProfessionAssignments()
    }
  }

  const handleSaveClick = () => {
    const isEditing = !!editingMembershipUserId
    const departmentRoleChanged = isEditing && !!originalDepartmentRoleKey && selectedRole !== originalDepartmentRoleKey

    const effectiveSelectedProfessionRoleId =
      selectedProfessionRoleId !== PROFESSION_ROLE_NONE && !professionRolesById.has(selectedProfessionRoleId)
        ? PROFESSION_ROLE_NONE
        : selectedProfessionRoleId

    const professionRoleChanged = isEditing && effectiveSelectedProfessionRoleId !== originalProfessionRoleId

    const professionActiveChanged =
      isEditing &&
      !professionRoleChanged &&
      effectiveSelectedProfessionRoleId !== PROFESSION_ROLE_NONE &&
      selectedProfessionActive !== originalProfessionActive

    const professionChanged = professionRoleChanged || professionActiveChanged

    if (!selectedActive || !activeMembershipElsewhere) {
      if (departmentRoleChanged) {
        setAssignPanelMode("confirm_department_role_change")
        return
      }
      if (professionChanged) {
        setAssignPanelMode("confirm_profession_change")
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
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Profession
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
                    <TableCell colSpan={4}>
                      <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                    </TableCell>
                  </TableRow>
                ))
              ) : people.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
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
                    <TableCell className="px-6 py-4">
                      {(() => {
                        const prof = professionAssignmentByUserId.get(m.user_id)
                        const profRoleName =
                          prof?.role?.name ||
                          (prof?.role_id ? professionRolesById.get(prof.role_id)?.name : null) ||
                          null
                        const profLabel = profRoleName ? profRoleName : "unassigned"
                        const profSuffix = prof && !prof.is_active ? " (inactive)" : ""
                        return (
                          <Badge variant={prof?.is_active ? "secondary" : "outline"}>
                            {`${profLabel}${profSuffix}`}
                          </Badge>
                        )
                      })()}
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
                                const prof = professionAssignmentByUserId.get(m.user_id)
                                const nextProfessionRoleId =
                                  prof?.role_id && professionRolesById.has(prof.role_id)
                                    ? prof.role_id
                                    : PROFESSION_ROLE_NONE
                                setSelectedProfessionRoleId(nextProfessionRoleId)
                                setSelectedProfessionActive(prof?.is_active ?? true)
                                setOriginalProfessionRoleId(
                                  prof?.role_id && professionRolesById.has(prof.role_id)
                                    ? prof.role_id
                                    : PROFESSION_ROLE_NONE
                                )
                                setOriginalProfessionActive(prof?.is_active ?? true)
                                setUserQuery(m.user?.email || m.user?.name || "")
                                setSearchResults([])
                                setAssignPanelMode("form")
                              },
                            },
                            {
                              type: "item",
                              label: "Deactivate",
                              icon: <UserX className="mr-2 h-4 w-4" />,
                              destructive: true,
                              onSelect: () => confirmDeactivateMember(m),
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
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        title={
          assignPanelMode === "confirm_move"
            ? "Move active membership?"
            : assignPanelMode === "confirm_department_role_change"
              ? "Confirm access change?"
              : assignPanelMode === "confirm_profession_change"
                ? "Confirm profession role change?"
                : editingMembershipUserId
                  ? "Edit member"
                  : "Assign user"
        }
        description={
          assignPanelMode === "confirm_move"
            ? "This user is active in another department. Continuing will move their active membership to this department."
            : assignPanelMode === "confirm_department_role_change"
              ? "This will change this member's department access control."
              : assignPanelMode === "confirm_profession_change"
                ? "This will update the member's profession role in this department."
                : editingMembershipUserId
                  ? "Update this member's access and active status for this department."
                  : "Select a user and choose their role in this department."
        }
        footer={
          assignPanelMode === "confirm_move" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPanelMode("form")} disabled={saving}>
                Back
              </Button>
              <Button onClick={saveMembership} disabled={saving}>
                Continue
              </Button>
            </div>
          ) : assignPanelMode === "confirm_department_role_change" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPanelMode("form")} disabled={saving}>
                Back
              </Button>
              <Button
                onClick={() => {
                  const isEditing = !!editingMembershipUserId

                  const effectiveSelectedProfessionRoleId =
                    selectedProfessionRoleId !== PROFESSION_ROLE_NONE &&
                    !professionRolesById.has(selectedProfessionRoleId)
                      ? PROFESSION_ROLE_NONE
                      : selectedProfessionRoleId

                  const professionRoleChanged =
                    isEditing && effectiveSelectedProfessionRoleId !== originalProfessionRoleId
                  const professionActiveChanged =
                    isEditing &&
                    !professionRoleChanged &&
                    effectiveSelectedProfessionRoleId !== PROFESSION_ROLE_NONE &&
                    selectedProfessionActive !== originalProfessionActive

                  const professionChanged = professionRoleChanged || professionActiveChanged

                  if (professionChanged) {
                    setAssignPanelMode("confirm_profession_change")
                    return
                  }

                  saveMembership()
                }}
                disabled={saving}
              >
                Continue
              </Button>
            </div>
          ) : assignPanelMode === "confirm_profession_change" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPanelMode("form")} disabled={saving}>
                Back
              </Button>
              <Button onClick={saveMembership} disabled={saving}>
                Continue
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveClick} disabled={saving || checkingActiveMembership}>
                Save
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-4 pt-4">
          {assignPanelMode === "confirm_move" ? (
            <div className="space-y-3">
              <div className="bg-muted/20 rounded-md border p-4">
                <div className="text-sm font-semibold">Confirm move</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {activeMembershipElsewhere
                    ? `This user is currently active in “${activeMembershipElsewhere.department_name || activeMembershipElsewhere.department_id}”. Continuing will deactivate their membership there and activate them in this department.`
                    : "This user is currently active in another department. Continuing will deactivate their membership there and activate them in this department."}
                </div>
              </div>

              <div className="text-muted-foreground text-xs">
                Your selected role and profession settings will be saved along with this change.
              </div>
            </div>
          ) : assignPanelMode === "confirm_department_role_change" ? (
            <div className="space-y-3">
              <div className="bg-muted/20 rounded-md border p-4">
                <div className="text-sm font-semibold">Confirm department access change</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {(() => {
                    const roleLabelByKey = new Map(departmentRoles.map((r) => [r.key, r.label]))
                    const prevLabel = roleLabelByKey.get(originalDepartmentRoleKey) || originalDepartmentRoleKey || ""
                    const nextLabel = roleLabelByKey.get(selectedRole) || selectedRole
                    return `Department access: ${prevLabel} → ${nextLabel}`
                  })()}
                </div>
              </div>

              <div className="text-muted-foreground text-xs">Your changes will be applied after saving.</div>
            </div>
          ) : assignPanelMode === "confirm_profession_change" ? (
            <div className="space-y-3">
              <div className="bg-muted/20 rounded-md border p-4">
                <div className="text-sm font-semibold">Confirm profession role change</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {(() => {
                    const originalLabel =
                      originalProfessionRoleId === PROFESSION_ROLE_NONE
                        ? "Unassigned"
                        : professionRolesById.get(originalProfessionRoleId)?.name || originalProfessionRoleId

                    const effectiveSelectedProfessionRoleId =
                      selectedProfessionRoleId !== PROFESSION_ROLE_NONE &&
                      !professionRolesById.has(selectedProfessionRoleId)
                        ? PROFESSION_ROLE_NONE
                        : selectedProfessionRoleId

                    const nextLabel =
                      effectiveSelectedProfessionRoleId === PROFESSION_ROLE_NONE
                        ? "Unassigned"
                        : professionRolesById.get(effectiveSelectedProfessionRoleId)?.name ||
                          effectiveSelectedProfessionRoleId

                    return `Profession role: ${originalLabel} → ${nextLabel}`
                  })()}
                </div>
                {(() => {
                  const effectiveSelectedProfessionRoleId =
                    selectedProfessionRoleId !== PROFESSION_ROLE_NONE &&
                    !professionRolesById.has(selectedProfessionRoleId)
                      ? PROFESSION_ROLE_NONE
                      : selectedProfessionRoleId

                  if (effectiveSelectedProfessionRoleId === PROFESSION_ROLE_NONE) return null
                  if (effectiveSelectedProfessionRoleId !== originalProfessionRoleId) return null
                  if (selectedProfessionActive === originalProfessionActive) return null

                  const prev = originalProfessionActive ? "On" : "Off"
                  const next = selectedProfessionActive ? "On" : "Off"
                  return (
                    <div className="text-muted-foreground mt-1 text-sm">{`Profession role active: ${prev} → ${next}`}</div>
                  )
                })()}
              </div>

              <div className="text-muted-foreground text-xs">This change takes effect immediately after saving.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">User</div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search by email, name, or username"
                      className={userQuery ? "pr-8" : undefined}
                      disabled={!!editingMembershipUserId}
                    />
                    {userQuery && !editingMembershipUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserQuery("")
                          setSelectedUserId(null)
                          setSelectedUser(null)
                          setSearchResults([])
                        }}
                        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-2 my-auto flex h-4 w-4 items-center justify-center rounded-full focus:outline-none"
                        aria-label="Clear user search"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {!!editingMembershipUserId && (
                  <div className="text-muted-foreground text-xs">
                    User cannot be changed when editing a member. Close this panel and use Assign user to add a
                    different member.
                  </div>
                )}

                {!editingMembershipUserId && searchLoading && userQuery.trim() && (
                  <div className="text-muted-foreground text-xs">Searching...</div>
                )}

                {!editingMembershipUserId && searchResults.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded-md border">
                    {searchResults.map((u) => (
                      <button
                        key={u.user_id}
                        type="button"
                        className={`hover:bg-muted w-full px-3 py-2 text-left text-sm ${
                          selectedUserId === u.user_id ? "bg-muted" : ""
                        }`}
                        onClick={() => {
                          setSelectedUserId(u.user_id)
                          setSelectedUser(u)
                        }}
                      >
                        <div className="font-medium">{u.name || "Unknown"}</div>
                        <div className="text-muted-foreground">{u.email || u.user_id}</div>
                      </button>
                    ))}
                  </div>
                )}

                {!editingMembershipUserId && selectedUserId && (
                  <div className="text-muted-foreground text-xs">Selected user_id: {selectedUserId}</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Department Access Control</div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentRoles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {deptRolesLoading && <div className="text-muted-foreground text-xs">Loading roles...</div>}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Profession role</div>
                <Select value={selectedProfessionRoleId} onValueChange={(v) => setSelectedProfessionRoleId(v)}>
                  <SelectTrigger disabled={professionRolesLoading || professionRoles.length === 0}>
                    <SelectValue
                      placeholder={
                        professionRolesLoading
                          ? "Loading..."
                          : professionRoles.length === 0
                            ? "No roles"
                            : "Select role"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROFESSION_ROLE_NONE}>Unassigned</SelectItem>
                    {professionRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfessionRoleId !== PROFESSION_ROLE_NONE && (
                  <div className="text-muted-foreground text-xs">
                    {professionRolesById.get(selectedProfessionRoleId)?.description || ""}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Profession role active</div>
                  <div className="text-muted-foreground text-xs">
                    Inactive removes profession access without deleting history.
                  </div>
                </div>
                <Switch
                  checked={selectedProfessionActive}
                  onCheckedChange={setSelectedProfessionActive}
                  disabled={selectedProfessionRoleId === PROFESSION_ROLE_NONE || !selectedActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-muted-foreground text-xs">
                    Inactive removes access without deleting history.
                    {selectedActive ? (
                      checkingActiveMembership ? (
                        <span className="mt-2 flex items-center gap-2">
                          <span className="bg-muted text-foreground inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Checking membership
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            Looking for other active departments…
                          </span>
                        </span>
                      ) : activeMembershipElsewhere ? (
                        <span className="mt-2 block rounded-md border border-red-500 bg-red-50 p-2 font-semibold text-red-700">
                          {`This user is currently active in “${activeMembershipElsewhere.department_name || activeMembershipElsewhere.department_id}”. Saving will deactivate their membership there and activate them in this department.`}
                        </span>
                      ) : (
                        <span className="mt-2 block">
                          A user can only be active in one department at a time; activating here will deactivate their
                          other active membership.
                        </span>
                      )
                    ) : (
                      ""
                    )}
                  </div>
                </div>
                <Switch checked={selectedActive} onCheckedChange={setSelectedActive} />
              </div>
            </div>
          )}
        </div>
      </RightSidePanel>

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
