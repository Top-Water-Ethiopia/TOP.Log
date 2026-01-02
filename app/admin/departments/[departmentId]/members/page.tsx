"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { DepartmentProfessionsManager } from "@/components/department-professions-manager"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { Briefcase, Pencil, Trash2, Users, X as XIcon } from "lucide-react"
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

type Department = {
  id: string
  name: string
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
  const searchParams = useSearchParams()
  const departmentId = params.departmentId
  const { toast } = useToast()

  const initialTab = searchParams.get("tab") === "professions" ? "professions" : "members"
  const [tab, setTab] = useState<"members" | "professions">(initialTab)

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin =
    profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<MembershipRow[]>([])

  const [departmentName, setDepartmentName] = useState<string | null>(null)

  const [professionRolesLoading, setProfessionRolesLoading] = useState(true)
  const [professionRoles, setProfessionRoles] = useState<ProfessionRoleRow[]>([])
  const [professionAssignments, setProfessionAssignments] = useState<ProfessionAssignmentRow[]>([])

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
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
    const nextTab = searchParams.get("tab") === "professions" ? "professions" : "members"
    setTab(nextTab)
  }, [searchParams])

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

  const loadDepartmentName = async () => {
    try {
      const res = await fetch("/api/admin/departments")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      const depts = (json.data || []) as Department[]
      const dept = depts.find((d) => d.id === departmentId)
      setDepartmentName(dept?.name || null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load department",
        variant: "destructive",
      })
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
    loadMemberships()
    loadDepartmentName()
    loadProfessionRoles()
    loadProfessionAssignments()
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
    setSelectedUserId(null)
    setSelectedRole("contributor")
    setSelectedActive(true)
    setSelectedProfessionRoleId(professionRoles[0]?.id || PROFESSION_ROLE_NONE)
    setSelectedProfessionActive(true)
  }

  const runUserSearch = async () => {
    const q = userQuery.trim()
    if (!q) return

    try {
      setSearchLoading(true)
      const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(q)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setSearchResults((json.data || []) as SearchUser[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to search users",
        variant: "destructive",
      })
    } finally {
      setSearchLoading(false)
    }
  }

  const saveMembership = async () => {
    if (!selectedUserId) {
      toast({
        title: "Missing user",
        description: "Select a user to assign",
        variant: "destructive",
      })
      return
    }

    try {
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

      const effectiveProfessionRoleId =
        selectedProfessionRoleId !== PROFESSION_ROLE_NONE && !professionRolesById.has(selectedProfessionRoleId)
          ? PROFESSION_ROLE_NONE
          : selectedProfessionRoleId

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
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {departmentName ? departmentName : "Department"}
          </h1>
          <p className="text-muted-foreground mt-1">Manage members and profession roles for this department.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "members" ? "default" : "outline"}
            onClick={() => {
              setTab("members")
              router.replace(`/admin/departments/${departmentId}/members`)
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Members
          </Button>
          <Button
            variant={tab === "professions" ? "default" : "outline"}
            onClick={() => {
              setTab("professions")
              router.replace(`/admin/departments/${departmentId}/members?tab=professions`)
            }}
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Profession roles
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={() => router.push("/admin/departments")}>Back</Button>
        {tab === "members" && <Button onClick={openAssign}>Assign user</Button>}
      </div>

      {tab === "members" ? (
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
                  <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.user?.name || "Unknown"}</div>
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
                            <Badge variant={prof?.is_active ? "secondary" : "outline"}>{`${profLabel}${profSuffix}`}</Badge>
                          </>
                        )
                      })()}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit membership"
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
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!removingUserId && removingUserId === m.user_id}
                        aria-label="Remove member"
                        onClick={() => confirmRemoveMember(m)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <DepartmentProfessionsManager departmentId={departmentId} embedded defaultTab="roles" />
      )}

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
                      className="absolute inset-y-0 right-2 my-auto flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none"
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
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
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
