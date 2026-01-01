"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Plus, Pencil, Trash2, Users, Briefcase, UserPlus, X as XIcon } from "lucide-react"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

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
}

export function DepartmentProfessionsManager({ departmentId }: Props) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const { toast } = useToast()

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin =
    profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const [tab, setTab] = useState<"roles" | "assignments">("roles")

  const [rolesLoading, setRolesLoading] = useState(true)
  const [roles, setRoles] = useState<RoleRow[]>([])

  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])

  const [departmentName, setDepartmentName] = useState<string | null>(null)

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

  const loadRoles = async () => {
    try {
      setRolesLoading(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/profession-roles`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setRoles((json.data || []) as RoleRow[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load profession roles",
        variant: "destructive",
      })
    } finally {
      setRolesLoading(false)
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

  const loadAssignments = async () => {
    try {
      setAssignmentsLoading(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/profession-assignments`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      setAssignments((json.data || []) as AssignmentRow[])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load profession assignments",
        variant: "destructive",
      })
    } finally {
      setAssignmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !isAdmin) return
    if (!departmentId) return
    loadRoles()
    loadAssignments()
    loadDepartmentName()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, departmentId])

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

    try {
      setRoleSaving(true)
      const payload: any = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
      }
      if (roleForm.level.trim()) payload.level = Number(roleForm.level)

      const res = await fetch(`/api/admin/departments/${departmentId}/profession-roles`, {
        method: editingRole ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRole ? { ...payload, id: editingRole.id } : payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Error",
          description: json.message || json.error || `HTTP ${res.status}`,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Saved",
        description: editingRole ? "Profession role updated" : "Profession role created",
      })

      setShowRoleDialog(false)
      await loadRoles()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save role",
        variant: "destructive",
      })
    } finally {
      setRoleSaving(false)
    }
  }

  const confirmDeleteRole = (r: RoleRow) => {
    setRoleToDelete(r)
    setShowDeleteRoleDialog(true)
  }

  const deleteRole = async () => {
    if (!roleToDelete || roleDeleting) return

    try {
      setRoleDeleting(true)
      const res = await fetch(
        `/api/admin/departments/${departmentId}/profession-roles?id=${encodeURIComponent(roleToDelete.id)}`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      toast({ title: "Deleted", description: "Profession role deleted" })
      setShowDeleteRoleDialog(false)
      setRoleToDelete(null)
      await loadRoles()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete role",
        variant: "destructive",
      })
    } finally {
      setRoleDeleting(false)
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

    try {
      setAssignSaving(true)
      const res = await fetch(`/api/admin/departments/${departmentId}/profession-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          role_id: selectedRoleId,
          is_active: selectedActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      toast({ title: "Saved", description: "Profession assignment updated" })
      setShowAssignDialog(false)
      await loadAssignments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save assignment",
        variant: "destructive",
      })
    } finally {
      setAssignSaving(false)
    }
  }

  const confirmRemoveAssignment = (a: AssignmentRow) => {
    setAssignmentToRemove(a)
  }

  const removeAssignment = async () => {
    if (!assignmentToRemove) return

    try {
      setRemovingUserId(assignmentToRemove.user_id)
      const res = await fetch(
        `/api/admin/departments/${departmentId}/profession-assignments/${assignmentToRemove.user_id}`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      const removedUserId = assignmentToRemove.user_id
      const removedDisplayName = assignmentToRemove.user?.name || assignmentToRemove.user?.email || removedUserId

      toast({
        title: "Removed",
        description: `${removedDisplayName} removed from profession role`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                const prevRoleId = assignmentToRemove.role_id
                const undoRes = await fetch(`/api/admin/departments/${departmentId}/profession-assignments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: removedUserId,
                    role_id: prevRoleId,
                    is_active: true,
                  }),
                })
                const undoJson = await undoRes.json().catch(() => ({}))
                if (!undoRes.ok) throw new Error(undoJson.message || undoJson.error || `HTTP ${undoRes.status}`)
                toast({ title: "Restored", description: "Profession assignment restored" })
                await loadAssignments()
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

      setAssignmentToRemove(null)
      await loadAssignments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove assignment",
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
    }
  }

  const hardDeleteAssignment = async () => {
    if (!assignmentToHardDelete) return

    try {
      setRemovingUserId(assignmentToHardDelete.user_id)
      const res = await fetch(
        `/api/admin/departments/${departmentId}/profession-assignments/${assignmentToHardDelete.user_id}?mode=hard`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)

      toast({ title: "Deleted", description: "Assignment permanently deleted" })
      setAssignmentToHardDelete(null)
      setHardDeleteConfirmText("")
      await loadAssignments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to permanently delete assignment",
        variant: "destructive",
      })
    } finally {
      setRemovingUserId(null)
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
            <CardDescription>You don't have permission to manage professions.</CardDescription>
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
            {departmentName ? `${departmentName} profession roles` : "Profession roles"}
          </h1>
          <p className="text-muted-foreground mt-1">
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
            Members
          </Button>
        </div>
      </div>

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
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : sortedRoles.length === 0 ? (
              <div className="text-sm text-muted-foreground">No roles yet. Create your first role to start assigning members.</div>
            ) : (
              <div className="space-y-2">
                {sortedRoles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{r.name}</div>
                        {typeof r.level === "number" && <Badge variant="secondary">level {r.level}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{r.description || "-"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 text-xs h-8"
                        onClick={() => openAssign(r.id)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Assign member</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openEditRole(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        onClick={() => setRoleToDelete(r)}
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
              <div className="text-sm text-muted-foreground">Create at least one role before assigning members.</div>
            ) : assignmentsLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </div>
            ) : sortedAssignments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No members assigned to roles yet.</div>
            ) : (
              <div className="space-y-2">
                {sortedAssignments.map((a) => {
                  const role = a.role || rolesById.get(a.role_id) || null
                  const roleName = role?.name || a.role_id
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.user?.name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground truncate">{a.user?.email || a.user_id}</div>
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
                          aria-label="Remove assignment"
                          disabled={!!removingUserId && removingUserId === a.user_id}
                          onClick={() => confirmRemoveAssignment(a)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              Role name must be lowercase with hyphens (example: `deckhand`).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profession_role_name">Role name</Label>
              <Input
                id="profession_role_name"
                value={roleForm.name}
                onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. deckhand"
              />
              {roleFormErrors.name && <div className="text-sm text-destructive">{roleFormErrors.name}</div>}
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
              <Input
                id="profession_role_level"
                value={roleForm.level}
                onChange={(e) => setRoleForm((p) => ({ ...p, level: e.target.value }))}
                placeholder="Optional numeric priority (smaller = higher priority)"
              />
              {roleFormErrors.level && <div className="text-sm text-destructive">{roleFormErrors.level}</div>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={roleSaving}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={roleSaving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteRoleDialog} onOpenChange={setShowDeleteRoleDialog}>
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
                <div className="text-xs text-muted-foreground">Inactive disables question visibility without deleting history.</div>
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
            <AlertDialogTitle>Remove assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user's profession role for this department. You can re-enable later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingUserId}>Cancel</AlertDialogCancel>
            {isSuperAdmin && (
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
            <AlertDialogAction disabled={!!removingUserId} onClick={removeAssignment}>
              Remove
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
