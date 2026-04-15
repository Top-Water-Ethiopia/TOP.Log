"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import {
  MoreVertical,
  Pencil,
  Search,
  Star,
  Trash2,
  UserCheck,
  UserX,
  History,
  ArrowRightLeft,
  X as XIcon,
} from "lucide-react"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import useSWR from "swr"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"
import type {
  MembershipHistoryItem,
  MembershipHistoryResponse,
  MembershipHistorySummary,
} from "@/lib/memberships/history"

type DepartmentRoleRow = {
  id: string
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
  membership_type: "profession" | "access_level"
  role_id: string
  is_active: boolean
  is_primary: boolean
  created_at: string
  updated_at: string
  role: {
    id: string
    type: "profession" | "access_level"
    name: string
    display_name: string
    level?: number
  }
  user?: { name: string | null; email: string | null }
}

type AllMembershipRow = {
  user_id: string | null
  department_id: string | null
  membership_type: "profession" | "access_level"
  role_id: string
  role: {
    id: string
    name: string
    display_name: string
  }
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

type GroupedHistoryEvents = {
  label: string
  items: MembershipHistoryItem[]
}

type PersonRow = {
  id: string
  user_id: string
  user?: { name: string | null; email: string | null }
  is_active: boolean
  is_primary: boolean
  primaryMembership: MembershipRow
  memberships: MembershipRow[]
  searchableRoles: string[]
}

function getHistoryGroupLabel(timestamp: string | null) {
  if (!timestamp) return "Date unavailable"
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return "Date unavailable"

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

function getSeverityClasses(severity: MembershipHistoryItem["severity"]) {
  switch (severity) {
    case "high":
      return {
        badge: "destructive" as const,
        card: "border-red-200 bg-red-50/40",
      }
    case "medium":
      return {
        badge: "default" as const,
        card: "border-slate-200 bg-white",
      }
    default:
      return {
        badge: "outline" as const,
        card: "border-slate-200 bg-slate-50/40",
      }
  }
}

function getMembershipPriority(membership: MembershipRow) {
  if (membership.membership_type === "profession" && membership.is_primary) return 0
  if (membership.membership_type === "profession" && membership.is_active) return 1
  if (membership.membership_type === "profession") return 2
  if (membership.is_active) return 3
  return 4
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

  const deptRolesKey = canAccessAdmin ? "/api/admin/department-professions" : null
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
  const [deactivateReason, setDeactivateReason] = useState("")
  const [memberToHardDelete, setMemberToHardDelete] = useState<MembershipRow | null>(null)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")
  const [memberToViewHistory, setMemberToViewHistory] = useState<MembershipRow | null>(null)
  const [historySummary, setHistorySummary] = useState<MembershipHistorySummary | null>(null)
  const [historyEvents, setHistoryEvents] = useState<MembershipHistoryItem[]>([])
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [memberToMove, setMemberToMove] = useState<MembershipRow | null>(null)
  const [moveTargetDepartmentId, setMoveTargetDepartmentId] = useState("")
  const [moveNewRole, setMoveNewRole] = useState("")
  const [moveReason, setMoveReason] = useState("")
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string }[]>([])
  const [targetDeptRoles, setTargetDeptRoles] = useState<DepartmentRoleRow[]>([])
  const [targetDeptRolesLoading, setTargetDeptRolesLoading] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const lastMembershipsErrorRef = useRef<string | null>(null)

  const groupedHistoryEvents = useMemo<GroupedHistoryEvents[]>(() => {
    const groups = new Map<string, MembershipHistoryItem[]>()

    historyEvents.forEach((event) => {
      const label = getHistoryGroupLabel(event.timestamp)
      const existing = groups.get(label) || []
      existing.push(event)
      groups.set(label, existing)
    })

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [historyEvents])

  // Fetch roles for the target department when moving a member
  useEffect(() => {
    if (!moveTargetDepartmentId) {
      setTargetDeptRoles([])
      setMoveNewRole("")
      return
    }

    const fetchTargetRoles = async () => {
      setTargetDeptRolesLoading(true)
      try {
        const response = await apiFetch<{ data: DepartmentRoleRow[] }>(
          `/api/admin/departments/${moveTargetDepartmentId}/profession-roles`
        )
        if (response.data) {
          setTargetDeptRoles(response.data.filter((r) => r.is_active))
        }
      } catch (err) {
        console.error("[MoveDialog] Failed to fetch target department roles:", err)
      } finally {
        setTargetDeptRolesLoading(false)
      }
    }

    fetchTargetRoles()
  }, [moveTargetDepartmentId])

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
            data: rows.map((row) => (row.id === m.id ? { ...row, is_active: true, updated_at: nowIso } : row)),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{
        data: MembershipRow
      }>(`/api/admin/departments/${departmentId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membership_id: m.id,
          user_id: restoredUserId,
          is_active: true,
          last_updated_at: m.updated_at,
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

  const deactivateMember = async (reason?: string) => {
    if (!memberToDeactivate) return
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse

    try {
      setRemovingUserId(memberToDeactivate.user_id)
      const nowIso = new Date().toISOString()
      const membershipId = memberToDeactivate.id
      const removedUserId = memberToDeactivate.user_id
      const removedDisplayName = memberToDeactivate.user?.name || memberToDeactivate.user?.email || removedUserId

      mutateMemberships(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return {
            data: rows.map((m) => (m.id === membershipId ? { ...m, is_active: false, updated_at: nowIso } : m)),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{ data: unknown }>(`/api/admin/departments/${departmentId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membership_id: membershipId,
          user_id: removedUserId,
          is_active: false,
          last_updated_at: memberToDeactivate.updated_at,
          reason,
        }),
      })

      setDeactivateReason("")

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
                        m.id === membershipId ? { ...m, is_active: true, updated_at: nowIso } : m
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
                    role_id: string
                    membership_type: string
                    is_active: boolean
                    created_at: string
                    updated_at: string
                  }
                }>(`/api/admin/departments/${departmentId}/memberships`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: removedUserId,
                    role_id: memberToDeactivate.role_id,
                    membership_type: memberToDeactivate.membership_type,
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

  const setMemberAsPrimary = async (m: MembershipRow) => {
    if (!departmentId) return

    const prevMembershipsResponse = membershipsResponse

    try {
      setRemovingUserId(m.user_id)
      const nowIso = new Date().toISOString()

      // Optimistic update: set this member as primary, remove primary from others
      mutateMemberships(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current?.data) ? current.data : []
          return {
            data: rows.map((row) => {
              if (row.user_id === m.user_id) {
                return { ...row, is_primary: true, updated_at: nowIso }
              }
              // Remove primary from other active memberships
              if (row.is_primary && row.is_active) {
                return { ...row, is_primary: false, updated_at: nowIso }
              }
              return row
            }),
          }
        },
        { revalidate: false }
      )

      await apiFetch<{
        data: MembershipRow
      }>(`/api/admin/departments/${departmentId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membership_id: m.id,
          user_id: m.user_id,
          is_primary: true,
          last_updated_at: m.updated_at,
        }),
      })

      toast({
        title: "Primary Set",
        description: `${m.user?.name || m.user?.email || m.user_id} is now the primary member`,
      })
    } catch (error: unknown) {
      if (prevMembershipsResponse) {
        mutateMemberships(prevMembershipsResponse, { revalidate: false })
      } else {
        mutateMemberships()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to set primary member"),
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
      mutateMemberships()
    }
  }

  const fetchHistory = async (m: MembershipRow) => {
    if (!departmentId) return
    setMemberToViewHistory(m)
    setHistoryLoading(true)
    setHistorySummary(null)
    setHistoryEvents([])
    setHistoryNextCursor(null)
    try {
      const json = await apiFetch<MembershipHistoryResponse>(
        `/api/admin/departments/${departmentId}/memberships/${m.user_id}/history`
      )
      setHistorySummary(json.summary)
      setHistoryEvents(json.events || [])
      setHistoryNextCursor(json.nextCursor || null)
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to load history"),
        variant: "destructive",
      })
      setHistoryEvents([])
      setHistorySummary({
        status: m.is_active ? "active" : "inactive",
        isPrimary: !!m.is_primary,
        role: m.role.display_name,
        lastChangedAt: null,
        lastChangedLabel: "Date unavailable",
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadMoreHistory = async () => {
    if (!departmentId || !memberToViewHistory || !historyNextCursor) return

    setHistoryLoadingMore(true)
    try {
      const json = await apiFetch<MembershipHistoryResponse>(
        `/api/admin/departments/${departmentId}/memberships/${memberToViewHistory.user_id}/history?cursor=${encodeURIComponent(historyNextCursor)}`
      )

      setHistoryEvents((current) => {
        const seen = new Set(current.map((event) => event.id))
        const merged = [...current]
        json.events.forEach((event) => {
          if (!seen.has(event.id)) {
            merged.push(event)
          }
        })
        return merged
      })
      setHistoryNextCursor(json.nextCursor || null)
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to load more history"),
        variant: "destructive",
      })
    } finally {
      setHistoryLoadingMore(false)
    }
  }

  const people = useMemo<PersonRow[]>(() => {
    const grouped = new Map<string, MembershipRow[]>()

    memberships.forEach((membership) => {
      const existing = grouped.get(membership.user_id) || []
      existing.push(membership)
      grouped.set(membership.user_id, existing)
    })

    const rows = Array.from(grouped.entries()).map(([userId, userMemberships]) => {
      const sortedMemberships = [...userMemberships].sort((a, b) => {
        const priority = getMembershipPriority(a) - getMembershipPriority(b)
        if (priority !== 0) return priority
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })

      const primaryMembership = sortedMemberships[0]

      return {
        id: userId,
        user_id: userId,
        user: primaryMembership.user,
        is_active: sortedMemberships.some((membership) => membership.is_active),
        is_primary: sortedMemberships.some((membership) => membership.is_primary && membership.is_active),
        primaryMembership,
        memberships: sortedMemberships,
        searchableRoles: sortedMemberships.map((membership) => membership.role.display_name),
      }
    })

    rows.sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id
      const bn = b.user?.name || b.user?.email || b.user_id
      return an.localeCompare(bn)
    })

    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter((person) => {
      const name = (person.user?.name || "").toLowerCase()
      const email = (person.user?.email || "").toLowerCase()
      const roles = person.searchableRoles.join(" ").toLowerCase()
      return name.includes(q) || email.includes(q) || roles.includes(q)
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

  // Fetch all departments for move dialog
  useEffect(() => {
    if (!memberToMove) return
    const fetchDepartments = async () => {
      try {
        const response = await apiFetch<{
          data: Array<{ department_id: string; department?: { name?: string } | null }>
        }>("/api/departments")
        if (response.data) {
          const departments = response.data.map((m) => ({
            id: m.department_id,
            name: m.department?.name || "Unnamed Department",
          }))
          setAllDepartments(departments.filter((d) => d.id !== departmentId))
        }
      } catch (err) {
        console.error("[MoveDialog] Failed to fetch departments:", err)
      }
    }
    fetchDepartments()
  }, [memberToMove, departmentId])

  const moveMember = async () => {
    if (!memberToMove || !departmentId) return
    if (!moveTargetDepartmentId || !moveNewRole) {
      toast({
        title: "Error",
        description: "Please select a target department and role",
        variant: "destructive",
      })
      return
    }

    setMoveLoading(true)
    try {
      await apiFetch(`/api/admin/departments/${departmentId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          user_id: memberToMove.user_id,
          target_department_id: moveTargetDepartmentId,
          new_role: moveNewRole,
          reason: moveReason || undefined,
          last_updated_at: memberToMove.updated_at,
        }),
      })

      toast({
        title: "Member moved",
        description: `${memberToMove.user?.name || memberToMove.user?.email || memberToMove.user_id} has been moved to the new department`,
      })

      // Close dialog and reset
      setMemberToMove(null)
      setMoveTargetDepartmentId("")
      setMoveNewRole("")
      setMoveReason("")
      mutateMemberships()
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to move member"),
        variant: "destructive",
      })
    } finally {
      setMoveLoading(false)
    }
  }

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

      // Build proper Role object from selectedRole key
      const selectedRoleObj = departmentRoles.find((r) => r.key === selectedRole)
      const roleObject: MembershipRow["role"] = selectedRoleObj
        ? {
            id: `temp-role-${selectedRole}`,
            type: "profession",
            name: selectedRoleObj.key,
            display_name: selectedRoleObj.label,
          }
        : existingMembership?.role || {
            id: `temp-role-${selectedRole}`,
            type: "profession",
            name: selectedRole,
            display_name: selectedRole,
          }

      const optimisticMembership: MembershipRow = existingMembership
        ? {
            ...existingMembership,
            role: roleObject,
            is_active: selectedActive,
            is_primary: existingMembership.is_primary,
            updated_at: nowIso,
          }
        : {
            id: `temp-${selectedUserId}`,
            user_id: selectedUserId,
            department_id: deptId,
            membership_type: "profession",
            role_id: roleObject.id,
            role: roleObject,
            is_active: selectedActive,
            is_primary: false,
            created_at: nowIso,
            updated_at: nowIso,
            user: {
              name: selectedUser?.name || null,
              email: selectedUser?.email || null,
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
                      role: savedMembership.role.display_name,
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
        ? roleLabelByKey.get(existingMembership.role.name) || existingMembership.role.display_name
        : null
      const nextRoleLabel = roleLabelByKey.get(selectedRole) || selectedRole

      const changes: string[] = []
      if (isEditing && existingMembership) {
        if (existingMembership.role.name !== selectedRole) {
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
                          <TableCell>
                            {m.role ? <Badge variant="secondary">{m.role.display_name}</Badge> : "-"}
                          </TableCell>
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
                people.map((person) => {
                  const m = person.primaryMembership

                  return (
                    <TableRow key={person.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {(person.user?.name || "U")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`font-medium text-gray-900 dark:text-gray-100 ${!person.is_active ? "line-through" : ""}`}
                              >
                                {person.user?.name || "Unknown"}
                              </div>
                              {!person.is_active ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                >
                                  Deactivated
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {person.user?.email || person.user_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {person.memberships.map((membership) => (
                            <Badge
                              key={membership.id}
                              variant={membership.is_active ? "secondary" : "outline"}
                              className={
                                membership.membership_type === "access_level"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : ""
                              }
                            >
                              {membership.role.display_name}
                              {membership.membership_type === "access_level" ? " Access" : ""}
                            </Badge>
                          ))}
                          {person.is_active ? (
                            <Badge variant="default" className="bg-emerald-500 text-white hover:bg-emerald-600">
                              ● Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                            >
                              ● Inactive
                            </Badge>
                          )}
                          {person.is_primary && person.is_active && (
                            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                              ⭐ Primary
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
                                label: person.user?.name || person.user?.email || "Member",
                              },
                              { type: "separator" },
                              {
                                type: "item",
                                label: "Edit",
                                icon: <Pencil className="mr-2 h-4 w-4" />,
                                onSelect: () => {
                                  setShowAssignDialog(true)
                                  setSelectedUserId(person.user_id)
                                  setEditingMembershipUserId(person.user_id)
                                  setSelectedRole(m.role.name)
                                  setOriginalDepartmentRoleKey(m.role.name)
                                  setSelectedActive(m.is_active)
                                  setUserQuery(person.user?.email || person.user?.name || "")
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
                              ...(!m.is_primary && m.is_active
                                ? [
                                    {
                                      type: "item" as const,
                                      label: "Set as Primary",
                                      icon: <Star className="mr-2 h-4 w-4" />,
                                      onSelect: () => setMemberAsPrimary(m),
                                    },
                                    { type: "separator" as const },
                                  ]
                                : []),
                              { type: "separator" },
                              {
                                type: "item",
                                label: "Move to department",
                                icon: <ArrowRightLeft className="mr-2 h-4 w-4" />,
                                onSelect: () => {
                                  setMemberToMove(m)
                                  setMoveTargetDepartmentId("")
                                  setMoveNewRole(m.role.name)
                                  setMoveReason("")
                                },
                              },
                              {
                                type: "item",
                                label: "View history",
                                icon: <History className="mr-2 h-4 w-4" />,
                                onSelect: () => fetchHistory(m),
                              },
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
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RightSidePanel
        open={showAssignDialog}
        onOpenChange={(open) => {
          setShowAssignDialog(open)
          if (!open) {
            setSelectedUserId(null)
            setEditingMembershipUserId(null)
            setSelectedUser(null)
            setUserQuery("")
            setSearchResults([])
            setAssignPanelMode("form")
          }
        }}
        title={
          assignPanelMode === "confirm_move"
            ? "Move active membership?"
            : assignPanelMode === "confirm_department_role_change"
              ? "Confirm role change?"
              : editingMembershipUserId
                ? "Edit member"
                : "Assign user"
        }
        description={
          assignPanelMode === "confirm_move"
            ? "This user is active in another department. Continuing will move their active membership to this department."
            : assignPanelMode === "confirm_department_role_change"
              ? "This will change this member's department role."
              : editingMembershipUserId
                ? "Update this member's role and active status for this department."
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
                    ? `This user is currently active in "${activeMembershipElsewhere.department_name || activeMembershipElsewhere.department_id}". Continuing will deactivate their membership there and activate them in this department.`
                    : "This user is currently active in another department. Continuing will deactivate their membership there and activate them in this department."}
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                Your selected role settings will be saved along with this change.
              </div>
            </div>
          ) : assignPanelMode === "confirm_department_role_change" ? (
            <div className="space-y-3">
              <div className="bg-muted/20 rounded-md border p-4">
                <div className="text-sm font-semibold">Confirm department role change</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {(() => {
                    const roleLabelByKey = new Map(departmentRoles.map((r) => [r.key, r.label]))
                    const prevLabel = roleLabelByKey.get(originalDepartmentRoleKey) || originalDepartmentRoleKey || ""
                    const nextLabel = roleLabelByKey.get(selectedRole) || selectedRole
                    return `Department role: ${prevLabel} → ${nextLabel}`
                  })()}
                </div>
              </div>
              <div className="text-muted-foreground text-xs">Your changes will be applied after saving.</div>
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
                <div className="text-sm font-medium">Department role</div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentRoles.map((r) => (
                      <SelectItem key={r.id} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {deptRolesLoading && <div className="text-muted-foreground text-xs">Loading roles...</div>}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Access control</div>
                <Select
                  value={selectedAccessLevelId}
                  onValueChange={setSelectedAccessLevelId}
                  disabled={loadingAccessLevels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingAccessLevels ? "Loading..." : "Select access level"} />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((al) => (
                      <SelectItem key={al.id} value={al.id}>
                        {al.display_name || al.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingAccessLevels && <div className="text-muted-foreground text-xs">Loading access levels...</div>}
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
                          {`This user is currently active in "${activeMembershipElsewhere.department_name || activeMembershipElsewhere.department_id}". Saving will deactivate their membership there and activate them in this department.`}
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
          if (!open) {
            setMemberToDeactivate(null)
            setDeactivateReason("")
          }
        }}
        title="Deactivate member"
        description="This will deactivate access to this department. You can re-enable later."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMemberToDeactivate(null)
                setDeactivateReason("")
              }}
              disabled={!!removingUserId}
            >
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
                setDeactivateReason("")
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Permanently delete
            </Button>
            <Button variant="default" disabled={!!removingUserId} onClick={() => deactivateMember(deactivateReason)}>
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
          <div className="space-y-2">
            <Label htmlFor="deactivate-reason" className="text-sm font-medium">
              Reason (optional)
            </Label>
            <Textarea
              id="deactivate-reason"
              placeholder="e.g., End of contract, Role change, Temporary leave..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <p className="text-muted-foreground text-xs">
              This will be recorded in the audit log for future reference.
            </p>
          </div>
          <div className="text-muted-foreground text-xs">Deactivating does not delete history; it removes access.</div>
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={!!memberToViewHistory}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToViewHistory(null)
            setHistorySummary(null)
            setHistoryEvents([])
            setHistoryNextCursor(null)
          }
        }}
        title="Membership history"
        description={
          memberToViewHistory
            ? `Audit log for ${memberToViewHistory.user?.name || memberToViewHistory.user?.email || memberToViewHistory.user_id}`
            : ""
        }
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setMemberToViewHistory(null)
              setHistorySummary(null)
              setHistoryEvents([])
              setHistoryNextCursor(null)
            }}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4 pt-4">
          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-slate-50/70 p-4">
                <div className="mb-3 text-sm font-semibold">Current state</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wide uppercase">Status</div>
                    <div className="font-medium capitalize">{historySummary?.status || "inactive"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wide uppercase">Primary</div>
                    <div className="font-medium">{historySummary?.isPrimary ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wide uppercase">Role</div>
                    <div className="font-medium">{historySummary?.role || "Not available"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wide uppercase">Last changed</div>
                    <div className="font-medium">{historySummary?.lastChangedLabel || "Date unavailable"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">History</div>
                {historyEvents.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed py-8 text-center">
                    <div className="font-medium">No history yet</div>
                    <div className="mt-1 text-sm">This membership has no recorded changes.</div>
                  </div>
                ) : (
                  <>
                    {groupedHistoryEvents.map((group) => (
                      <div key={group.label} className="space-y-3">
                        <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                          {group.label}
                        </div>
                        {group.items.map((event) => {
                          const severity = getSeverityClasses(event.severity)
                          return (
                            <div key={event.id} className={`space-y-2 rounded-md border p-3 ${severity.card}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <Badge variant={severity.badge}>{event.eventCategory}</Badge>
                                  <div className="text-sm font-semibold">{event.summary}</div>
                                </div>
                                <div className="text-muted-foreground text-right text-xs">{event.timestampLabel}</div>
                              </div>
                              {event.details.length > 0 ? (
                                <div className="space-y-1">
                                  {event.details.map((detail) => (
                                    <div key={detail} className="text-muted-foreground text-sm">
                                      {detail}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="text-muted-foreground text-xs">By: {event.actor}</div>
                            </div>
                          )
                        })}
                      </div>
                    ))}

                    {historyNextCursor ? (
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" onClick={loadMoreHistory} disabled={historyLoadingMore}>
                          {historyLoadingMore ? "Loading..." : "Load more"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={!!memberToMove}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToMove(null)
            setMoveTargetDepartmentId("")
            setMoveNewRole("")
            setMoveReason("")
          }
        }}
        title="Move member"
        description="Move this member to another department. Their current membership will be deactivated."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMemberToMove(null)
                setMoveTargetDepartmentId("")
                setMoveNewRole("")
                setMoveReason("")
              }}
              disabled={moveLoading}
            >
              Cancel
            </Button>
            <Button variant="default" disabled={moveLoading || !moveTargetDepartmentId} onClick={moveMember}>
              {moveLoading ? "Moving..." : "Move member"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          <div className="bg-muted/20 rounded-md border p-4">
            <div className="text-sm font-semibold">
              {memberToMove?.user?.name || memberToMove?.user?.email || memberToMove?.user_id || "Member"}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              Current role: {memberToMove?.role.display_name} • Current department: This department
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-department">Target department</Label>
            <select
              id="target-department"
              value={moveTargetDepartmentId}
              onChange={(e) => setMoveTargetDepartmentId(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="">Select department...</option>
              {allDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">New role</Label>
            <select
              id="new-role"
              value={moveNewRole}
              onChange={(e) => setMoveNewRole(e.target.value)}
              disabled={!moveTargetDepartmentId || targetDeptRolesLoading}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              <option value="">
                {!moveTargetDepartmentId
                  ? "Select a department first..."
                  : targetDeptRolesLoading
                    ? "Loading roles..."
                    : "Select role..."}
              </option>
              {targetDeptRoles.map((role) => (
                <option key={role.id} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-reason">Reason (optional)</Label>
            <Textarea
              id="move-reason"
              placeholder="e.g., Team restructuring, Project transfer..."
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <p className="text-muted-foreground text-xs">This will be recorded in the audit log.</p>
          </div>

          <div className="text-muted-foreground text-xs">
            Note: The member's current membership will be deactivated and a new one will be created in the target
            department.
          </div>
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
