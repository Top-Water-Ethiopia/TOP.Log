"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Pencil, Trash2, X as XIcon } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

const DEPT_ROLES = [
  { value: "department_lead", label: "Department Lead" },
  { value: "department_manager", label: "Department Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "contributor", label: "Contributor" },
  { value: "viewer", label: "Viewer" },
] as const

type DeptRole = (typeof DEPT_ROLES)[number]["value"]

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

export default function AdminDepartmentMembersPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const pathname = usePathname()
  const departmentId = params.departmentId
  const { toast } = useToast()

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin =
    profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<MembershipRow[]>([])

  const [professionRolesLoading, setProfessionRolesLoading] = useState(true)
  const [professionRoles, setProfessionRoles] = useState<ProfessionRoleRow[]>([])
  const [professionAssignments, setProfessionAssignments] = useState<ProfessionAssignmentRow[]>([])

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<DeptRole>("contributor")
  const [selectedActive, setSelectedActive] = useState(true)
  const PROFESSION_ROLE_NONE = "__none__"
  const [selectedProfessionRoleId, setSelectedProfessionRoleId] = useState<string>(PROFESSION_ROLE_NONE)
  const [selectedProfessionActive, setSelectedProfessionActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<MembershipRow | null>(null)
  const [memberToHardDelete, setMemberToHardDelete] = useState<MembershipRow | null>(null)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("")

  const loadProfessionRoles = async () => {
    try {
      setProfessionRolesLoading(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/profession-roles`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setProfessionRoles((json.data || []) as ProfessionRoleRow[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load profession roles",
        variant: "destructive",
      })
    } finally {
      setProfessionRolesLoading(false)
    }
  }

  const loadProfessionAssignments = async () => {
    try {
      const res = await fetch(`/api/admin/departments/${departmentId}/profession-assignments`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setProfessionAssignments((json.data || []) as ProfessionAssignmentRow[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load profession assignments",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  useEffect(() => {
    if (isLoading) return
    if (!user || !isAdmin) return
    if (!departmentId) return

    if (pathname.endsWith(`/admin/departments/${departmentId}/members`)) {
      router.replace(`/admin/departments/${departmentId}?tab=members`)
    }
  }, [pathname, isLoading, user, isAdmin, router, departmentId])

  const loadMemberships = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/memberships`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setMemberships((json.data || []) as MembershipRow[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const hardDeleteMember = async () => {
    if (!memberToHardDelete) return

    try {
      setRemovingUserId(memberToHardDelete.user_id)
      const res = await fetch(
        `/api/admin/departments/${departmentId}/memberships/${memberToHardDelete.user_id}?mode=hard`,
        {
          method: "DELETE",
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      toast({
        title: "Deleted",
        description: "Membership permanently deleted",
      })

      setMemberToHardDelete(null)
      setHardDeleteConfirmText("")
      await loadMemberships()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to permanently delete membership",
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
    }
  }

  const confirmRemoveMember = (m: MembershipRow) => {
    setMemberToRemove(m)
  }

  const removeMember = async () => {
    if (!memberToRemove) return

    try {
      setRemovingUserId(memberToRemove.user_id)
      const res = await fetch(
        `/api/admin/departments/${departmentId}/memberships/${memberToRemove.user_id}`,
        {
          method: "DELETE",
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      const removedUserId = memberToRemove.user_id
      const removedDisplayName = memberToRemove.user?.name || memberToRemove.user?.email || removedUserId

      toast({
        title: "Removed",
        description: `${removedDisplayName} removed from department`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                const undoRes = await fetch(`/api/admin/departments/${departmentId}/memberships`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: removedUserId,
                    is_active: true,
                  }),
                })
                const undoJson = await undoRes.json().catch(() => ({}))
                if (!undoRes.ok) throw new Error(undoJson.message || undoJson.error || `HTTP ${undoRes.status}`)
                toast({ title: "Restored", description: "Membership restored" })
                await loadMemberships()
              } catch (e: any) {
                toast({
                  title: "Error",
                  description: e?.message || "Failed to undo",
                  variant: "destructive",
                })
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      })

      setMemberToRemove(null)
      await loadMemberships()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove member",
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
    }
  }

  useEffect(() => {
    if (!user || !isAdmin) return
    if (!departmentId) return
    void Promise.all([loadMemberships(), loadProfessionRoles(), loadProfessionAssignments()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, departmentId])

  const professionRolesById = useMemo(() => {
    return new Map(professionRoles.map((r) => [r.id, r]))
  }, [professionRoles])

  const professionAssignmentByUserId = useMemo(() => {
    return new Map(professionAssignments.map((a) => [a.user_id, a]))
  }, [professionAssignments])

  const sorted = useMemo(() => {
    return [...memberships].sort((a, b) => {
      const an = a.user?.name || a.user?.email || a.user_id
      const bn = b.user?.name || b.user?.email || b.user_id
      return an.localeCompare(bn)
    })
  }, [memberships])

  const openAssign = () => {
    setShowAssignDialog(true)
    setUserQuery("")
    setSearchResults([])
    setSelectedUser(null)
    setSelectedUserId(null)
    setSelectedRole("contributor")
    setSelectedActive(true)
    setSelectedProfessionRoleId(PROFESSION_ROLE_NONE)
    setSelectedProfessionActive(true)
  }

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
      const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      if (requestId !== userSearchRequestIdRef.current) return
      setSearchResults((json.data || []) as SearchUser[])
    } catch (error: any) {
      if (controller.signal.aborted) return
      toast({
        title: "Error",
        description: error?.message || "Failed to search users",
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

    const prevMemberships = memberships
    const prevProfessionAssignments = professionAssignments

    try {
      const nowIso = new Date().toISOString()
      const existingMembership = memberships.find((m) => m.user_id === selectedUserId)

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
            department_id: departmentId,
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

      setMemberships((prev) => {
        const without = prev.filter((m) => m.user_id !== selectedUserId)
        return [optimisticMembership, ...without]
      })

      const effectiveProfessionRoleId =
        selectedProfessionRoleId !== PROFESSION_ROLE_NONE && !professionRolesById.has(selectedProfessionRoleId)
          ? PROFESSION_ROLE_NONE
          : selectedProfessionRoleId

      setProfessionAssignments((prev) => {
        if (effectiveProfessionRoleId === PROFESSION_ROLE_NONE) {
          return prev.filter((a) => a.user_id !== selectedUserId)
        }

        const existing = prev.find((a) => a.user_id === selectedUserId)
        const optimistic: ProfessionAssignmentRow = existing
          ? {
              ...existing,
              role_id: effectiveProfessionRoleId,
              is_active: selectedProfessionActive,
              updated_at: nowIso,
            }
          : {
              id: `temp-pa-${selectedUserId}`,
              user_id: selectedUserId,
              department_id: departmentId,
              role_id: effectiveProfessionRoleId,
              is_active: selectedProfessionActive,
              created_at: nowIso,
              updated_at: nowIso,
              role: professionRolesById.get(effectiveProfessionRoleId) || null,
            }

        const without = prev.filter((a) => a.user_id !== selectedUserId)
        return [optimistic, ...without]
      })

      setSaving(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
          is_active: selectedActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      const savedMembership = json?.data as
        | { id: string; user_id: string; department_id: string; role: string; is_active: boolean; created_at: string; updated_at: string }
        | undefined

      if (savedMembership?.id) {
        setMemberships((prev) =>
          prev.map((m) =>
            m.user_id === selectedUserId
              ? {
                  ...m,
                  id: savedMembership.id,
                  role: savedMembership.role,
                  is_active: savedMembership.is_active,
                  created_at: savedMembership.created_at,
                  updated_at: savedMembership.updated_at,
                }
              : m,
          ),
        )
      }

      if (effectiveProfessionRoleId === PROFESSION_ROLE_NONE) {
        const delRes = await fetch(
          `/api/admin/departments/${departmentId}/profession-assignments/${selectedUserId}`,
          { method: "DELETE" },
        )
        const delJson = await delRes.json().catch(() => ({}))
        if (!delRes.ok) throw new Error(delJson.message || delJson.error || `HTTP ${delRes.status}`)
      } else {
        const paRes = await fetch(`/api/admin/departments/${departmentId}/profession-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            role_id: effectiveProfessionRoleId,
            is_active: selectedProfessionActive,
          }),
        })
        const paJson = await paRes.json().catch(() => ({}))
        if (!paRes.ok) throw new Error(paJson.message || paJson.error || `HTTP ${paRes.status}`)
      }

      toast({ title: "Saved", description: "Department membership updated" })
      setShowAssignDialog(false)
      await loadMemberships()
      await loadProfessionAssignments()
    } catch (error: any) {
      setMemberships(prevMemberships)
      setProfessionAssignments(prevProfessionAssignments)
      toast({
        title: "Error",
        description: error?.message || "Failed to save membership",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
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
          <CardContent className="space-y-3">
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
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Button onClick={openAssign}>Assign user</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Active and inactive assignments for this department.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No members yet.</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    !m.is_active ? "opacity-70 bg-muted/30" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`font-medium truncate ${!m.is_active ? "line-through" : ""}`}>
                      {m.user?.name || "Unknown"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{m.user?.email || m.user_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const prof = professionAssignmentByUserId.get(m.user_id)
                      const profRoleName =
                        prof?.role?.name || (prof?.role_id ? professionRolesById.get(prof.role_id)?.name : null) || null
                      const profLabel = profRoleName ? profRoleName : "unassigned"
                      const profSuffix = prof && !prof.is_active ? " (inactive)" : ""
                      return (
                        <>
                          <Badge variant={m.is_active ? "secondary" : "outline"}>{m.role}</Badge>
                          {!m.is_active && (
                            <Badge variant="outline" className="border-dashed">
                              Inactive
                            </Badge>
                          )}
                          <Badge variant={prof?.is_active ? "secondary" : "outline"}>{`${profLabel}${profSuffix}`}</Badge>
                        </>
                      )
                    })()}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={!!removingUserId && removingUserId === m.user_id}
                        >
                          Manage
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{m.user?.name || m.user?.email || "Member"}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setShowAssignDialog(true)
                            setSelectedUserId(m.user_id)
                            setSelectedRole(m.role as DeptRole)
                            setSelectedActive(m.is_active)
                            const prof = professionAssignmentByUserId.get(m.user_id)
                            const nextProfessionRoleId =
                              prof?.role_id && professionRolesById.has(prof.role_id)
                                ? prof.role_id
                                : professionRoles[0]?.id || PROFESSION_ROLE_NONE
                            setSelectedProfessionRoleId(nextProfessionRoleId)
                            setSelectedProfessionActive(prof?.is_active ?? true)
                            setUserQuery(m.user?.email || m.user?.name || "")
                            setSearchResults([])
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => confirmRemoveMember(m)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setMemberToHardDelete(m)
                                setHardDeleteConfirmText("")
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Permanently delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign user</DialogTitle>
            <DialogDescription>Select a user and choose their role in this department.</DialogDescription>
          </DialogHeader>

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
                  />
                  {userQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserQuery("")
                        setSelectedUserId(null)
                        setSelectedUser(null)
                        setSearchResults([])
                      }}
                      className="absolute inset-y-0 right-2 my-auto flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label="Clear user search"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {searchLoading && userQuery.trim() && (
                <div className="text-xs text-muted-foreground">Searching...</div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-md border">
                  {searchResults.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
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

              {selectedUserId && (
                <div className="text-xs text-muted-foreground">Selected user_id: {selectedUserId}</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Department role</div>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as DeptRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {DEPT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Profession role</div>
              <Select value={selectedProfessionRoleId} onValueChange={(v) => setSelectedProfessionRoleId(v)}>
                <SelectTrigger disabled={professionRolesLoading || professionRoles.length === 0}>
                  <SelectValue
                    placeholder={professionRolesLoading ? "Loading..." : professionRoles.length === 0 ? "No roles" : "Select role"}
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
                <div className="text-xs text-muted-foreground">
                  {professionRolesById.get(selectedProfessionRoleId)?.description || ""}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Profession role active</div>
                <div className="text-xs text-muted-foreground">Inactive removes profession access without deleting history.</div>
              </div>
              <Switch
                checked={selectedProfessionActive}
                onCheckedChange={setSelectedProfessionActive}
                disabled={selectedProfessionRoleId === PROFESSION_ROLE_NONE}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive removes access without deleting history.</div>
              </div>
              <Switch checked={selectedActive} onCheckedChange={setSelectedActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveMembership} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove access to this department. You can re-enable later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingUserId}>Cancel</AlertDialogCancel>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                disabled={!!removingUserId}
                onClick={() => {
                  if (!memberToRemove) return
                  setMemberToHardDelete(memberToRemove)
                  setMemberToRemove(null)
                }}
              >
                Permanently delete
              </Button>
            )}
            <AlertDialogAction disabled={!!removingUserId} onClick={removeMember}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!memberToHardDelete}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToHardDelete(null)
            setHardDeleteConfirmText("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete membership</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type DELETE to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input value={hardDeleteConfirmText} onChange={(e) => setHardDeleteConfirmText(e.target.value)} />
          </div>

          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
