"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useSWR from "swr"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"
import { X as XIcon } from "lucide-react"

type DepartmentRoleRow = {
  id: string
  key: string
  label: string
  description: string | null
  department_id: string
  level: number
  created_at: string
  updated_at: string
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

export function DepartmentAssignDialog({ departmentId }: { departmentId: string }) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const membershipsKey = canAccessAdmin && departmentId ? `/api/admin/departments/${departmentId}/memberships` : null

  const deptRolesKey = canAccessAdmin && departmentId ? `/api/admin/departments/${departmentId}/profession-roles` : null
  const { data: deptRolesResponse, isLoading: deptRolesLoading } = useSWR<{ data: DepartmentRoleRow[] }>(deptRolesKey)

  const {
    data: membershipsResponse,
    error: membershipsError,
    mutate: mutateMemberships,
  } = useSWR<{ data: MembershipRow[] }>(membershipsKey)

  const memberships = useMemo(() => {
    return Array.isArray(membershipsResponse?.data) ? (membershipsResponse?.data ?? []) : []
  }, [membershipsResponse])

  const departmentRoles = useMemo(() => {
    const rows: DepartmentRoleRow[] = deptRolesResponse?.data ?? []
    return rows
  }, [deptRolesResponse])

  const defaultDepartmentRoleKey = useMemo(() => {
    if (departmentRoles.length === 0) return "__placeholder__"
    return departmentRoles[0].key
  }, [departmentRoles])

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [editingMembershipUserId, setEditingMembershipUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("__placeholder__")
  const [originalDepartmentRoleKey, setOriginalDepartmentRoleKey] = useState<string>("")
  const [selectedAccessLevelId, setSelectedAccessLevelId] = useState<string>("__placeholder__")
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

  const lastMembershipsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    const assignRole = searchParams.get("assignRole")
    if (!assignRole) return
    if (!departmentId) return
    if (!canAccessAdmin) return
    if (deptRolesLoading) return
    if (departmentRoles.length === 0) return

    // Match by key since assignRole comes from profession-roles table (r.key)
    const roleKeyToUse = departmentRoles.some((r) => r.key === assignRole)
      ? departmentRoles.find((r) => r.key === assignRole)!.key
      : defaultDepartmentRoleKey

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
    if (isLoading) return
    if (!user) return
    if (!rbacChecked || rbacLoading) return
    if (!canAccessAdmin) return
    if (!departmentId) return
  }, [isLoading, user, rbacChecked, rbacLoading, canAccessAdmin, departmentId])

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

  const runUserSearch = useCallback(
    async (query: string) => {
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
    },
    [toast]
  )

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
  }, [userQuery, showAssignDialog, runUserSearch])

  // Fetch access levels for dropdown
  useEffect(() => {
    const fetchAccessLevels = async () => {
      try {
        const response = await apiFetch<{ data: DepartmentAccessLevel[] }>("/api/admin/department-access-levels")
        if (response.data) {
          setAccessLevels(response.data)
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
          ? `Activated in this department and deactivated in "${moveFromLabel}".`
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

    if (!selectedAccessLevelId) {
      toast({
        title: "Validation Error",
        description: "Please select an access control level",
        variant: "destructive",
      })
      return
    }

    const selectedAccessLevel = accessLevels.find((al) => al.id === selectedAccessLevelId)
    const isSelectable =
      !!selectedAccessLevel &&
      selectedAccessLevel.is_active &&
      (selectedAccessLevel.name === "contributor" || selectedAccessLevel.name === "department_lead")

    if (!isSelectable) {
      toast({
        title: "Validation Error",
        description: "Selected access control level is not currently available",
        variant: "destructive",
      })
      return
    }

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

  // Don't render if not admin or still loading
  if (isLoading || rbacLoading || !user || !profile || !canAccessAdmin) {
    return null
  }

  return (
    <RightSidePanel
      open={showAssignDialog}
      onOpenChange={setShowAssignDialog}
      title={
        assignPanelMode === "confirm_move"
          ? "Move active membership?"
          : assignPanelMode === "confirm_department_role_change"
            ? "Confirm access change?"
            : editingMembershipUserId
              ? "Edit member"
              : "Assign user"
      }
      description={
        assignPanelMode === "confirm_move"
          ? "This user is active in another department. Continuing will move their active membership to this department."
          : assignPanelMode === "confirm_department_role_change"
            ? "This will change this member's department access control."
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
                  User cannot be changed when editing a member. Close this panel and use Assign user to add a different
                  member.
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
              <div className="text-sm font-medium">Profession role</div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {departmentRoles.map((r) => (
                    <SelectItem key={`${r.id}-${r.key}`} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deptRolesLoading && <div className="text-muted-foreground text-xs">Loading roles...</div>}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Access control <span className="text-destructive">*</span>
              </div>
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
                    <SelectItem
                      key={al.id}
                      value={al.id}
                      disabled={!(al.is_active && (al.name === "contributor" || al.name === "department_lead"))}
                    >
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
                        <span className="text-muted-foreground text-[11px]">Looking for other active departments…</span>
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
  )
}
