"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { useToast } from "@/components/ui/use-toast"
import { MoreVertical, Pencil, Plus, Trash2, UserPlus } from "lucide-react"

type DepartmentRoleRow = {
  id: string
  name: string
  display_name: string
  description: string | null
  department_id: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
  created_at: string
  updated_at: string
}

type RoleDraft = {
  key: string
  label: string
  description: string
}

type MembershipRow = {
  id: string
  user_id: string
  department_id: string
  role_id: string
  role: {
    id: string
    type: string
    name: string
    display_name: string
    level: number | null
  }
  is_active: boolean
}

export function DepartmentRolesTab({ departmentId }: { departmentId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const rolesKey = departmentId ? `/api/admin/departments/${departmentId}/profession-roles` : null
  const membershipsKey = departmentId ? `/api/admin/departments/${departmentId}/memberships` : null

  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: rolesLoading,
    mutate: mutateRoles,
  } = useSWR<{ data: DepartmentRoleRow[] }>(rolesKey, (url: string) => apiFetch<{ data: DepartmentRoleRow[] }>(url))

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: membershipsLoading,
    mutate: mutateMemberships,
  } = useSWR<{ data: MembershipRow[] }>(membershipsKey, (url: string) => apiFetch<{ data: MembershipRow[] }>(url))

  const roles = useMemo(() => {
    return rolesResponse?.data ?? []
  }, [rolesResponse])

  const memberships = useMemo(() => {
    return Array.isArray(membershipsResponse?.data) ? (membershipsResponse?.data ?? []) : []
  }, [membershipsResponse])

  const activeCountByRole = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of memberships) {
      if (!m.is_active) continue
      const roleName = typeof m.role === "object" && m.role ? m.role.name : String(m.role)
      map.set(roleName, (map.get(roleName) || 0) + 1)
    }
    return map
  }, [memberships])

  const loading = rolesLoading || membershipsLoading
  const error = rolesError || membershipsError

  const [showRolePanel, setShowRolePanel] = useState(false)
  const [editingRole, setEditingRole] = useState<DepartmentRoleRow | null>(null)
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleForm, setRoleForm] = useState<RoleDraft>({
    key: "",
    label: "",
    description: "",
  })
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({})

  const [showDeleteRolePanel, setShowDeleteRolePanel] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<DepartmentRoleRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [roleDeleting, setRoleDeleting] = useState(false)

  const lastRoleErrorRef = useRef<string | null>(null)

  const validateRoleForm = () => {
    const errors: Record<string, string> = {}
    const key = roleForm.key.trim()
    const label = roleForm.label.trim()

    if (!key) {
      errors.key = "Key is required"
    } else if (!/^[a-z0-9-]+$/.test(key)) {
      errors.key = "Use lowercase letters, numbers, and hyphens only"
    }

    if (!label) {
      errors.label = "Label is required"
    }

    setRoleFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm({ key: "", label: "", description: "" })
    setRoleFormErrors({})
    setShowRolePanel(true)
  }

  const openEditRole = (role: DepartmentRoleRow) => {
    setEditingRole(role)
    setRoleForm({
      key: role.name,
      label: role.display_name,
      description: role.description || "",
    })
    setRoleFormErrors({})
    setShowRolePanel(true)
  }

  const saveRole = async () => {
    if (roleSaving) return
    if (!validateRoleForm()) return

    try {
      setRoleSaving(true)

      const payload = {
        key: roleForm.key.trim(),
        label: roleForm.label.trim(),
        description: roleForm.description.trim(),
      }

      if (editingRole) {
        await apiFetch(`/api/admin/departments/${departmentId}/profession-roles?id=${editingRole.name}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast({ title: "Saved", description: "Department role updated" })
      } else {
        await apiFetch(`/api/admin/departments/${departmentId}/profession-roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast({ title: "Created", description: "Department role created" })
      }

      setShowRolePanel(false)
      await Promise.all([mutateRoles(), mutateMemberships()])
    } catch (e: unknown) {
      const message = getErrorMessage(e, editingRole ? "Failed to update role" : "Failed to create role")
      if (message !== lastRoleErrorRef.current) {
        lastRoleErrorRef.current = message
        toast({ title: "Error", description: message, variant: "destructive" })
      }
    } finally {
      setRoleSaving(false)
    }
  }

  const requestDeleteRole = (r: DepartmentRoleRow) => {
    setRoleToDelete(r)
    setDeleteConfirmText("")
    setShowDeleteRolePanel(true)
  }

  const deleteRole = async () => {
    if (!roleToDelete) return
    if (roleDeleting) return
    if (deleteConfirmText !== "DELETE") return

    try {
      setRoleDeleting(true)
      await apiFetch(`/api/admin/departments/${departmentId}/profession-roles?id=${roleToDelete.name}`, {
        method: "DELETE",
      })
      toast({ title: "Deleted", description: "Department role deleted" })
      setShowDeleteRolePanel(false)
      setRoleToDelete(null)
      await Promise.all([mutateRoles(), mutateMemberships()])
    } catch (e: unknown) {
      const error = e as { status?: number; json?: () => Promise<unknown> }

      // Try to get detailed error message from API response
      let errorMessage = "Failed to delete role"
      if (error.status === 409 && error.json) {
        try {
          const errorData = (await error.json()) as {
            hasAssignments?: boolean
            hasPermissions?: boolean
            message?: string
          }
          if (errorData.hasAssignments) {
            errorMessage = `Cannot delete role: ${errorData.message}`
          } else if (errorData.hasPermissions) {
            errorMessage = `Cannot delete role: ${errorData.message}`
          } else {
            errorMessage = errorData.message || errorMessage
          }
        } catch {
          // Fallback to generic error handling
        }
      }

      toast({ title: "Error", description: getErrorMessage(e, errorMessage), variant: "destructive" })
    } finally {
      setRoleDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Department roles</CardTitle>
          <Button onClick={openCreateRole}>
            <Plus className="mr-2 h-4 w-4" />
            Create role
          </Button>
        </div>
        <CardDescription>
          Roles are specific to this department. Assignments are managed through the Members tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200/60 dark:bg-gray-800" />
            ))}
          </div>
        ) : error ? (
          <div className="text-muted-foreground text-sm">{getErrorMessage(error, "Failed to load roles")}</div>
        ) : roles.length === 0 ? (
          <div className="text-muted-foreground text-sm">No active department roles found.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Role
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Name
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
                {roles.map((r) => {
                  const count = activeCountByRole.get(r.name) || 0

                  const items = [
                    {
                      type: "label",
                      label: r.display_name,
                    },
                    { type: "separator" },
                    {
                      type: "item",
                      label: "Edit",
                      icon: <Pencil className="mr-2 h-4 w-4" />,
                      onSelect: () => openEditRole(r),
                    },
                    {
                      type: "item",
                      label: "Assign to member",
                      icon: <UserPlus className="mr-2 h-4 w-4" />,
                      onSelect: () => {
                        router.push(
                          `/admin/departments/${departmentId}?assign=1&assignRole=${encodeURIComponent(r.name)}`
                        )
                      },
                    },
                    { type: "separator" },
                    {
                      type: "item",
                      label: "Delete",
                      icon: <Trash2 className="mr-2 h-4 w-4" />,
                      destructive: true,
                      onSelect: () => requestDeleteRole(r),
                      disabled: false,
                      title: undefined,
                    },
                  ] satisfies ActionMenuItem[]

                  return (
                    <TableRow key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{r.display_name}</div>
                          <div className="text-muted-foreground text-sm">({r.name})</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="text-muted-foreground text-sm">{r.description || "No description"}</div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant={count > 0 ? "secondary" : "outline"}>{count} active</Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <ActionMenu
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Role actions for ${r.display_name}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          }
                          items={items}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <RightSidePanel
        open={showRolePanel}
        onOpenChange={setShowRolePanel}
        title={editingRole ? "Edit department role" : "Create department role"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRolePanel(false)} disabled={roleSaving}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={roleSaving}>
              {roleSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department_role_key">Key</Label>
            <Input
              id="department_role_key"
              value={roleForm.key}
              disabled={!!editingRole}
              onChange={(e) => setRoleForm((p) => ({ ...p, key: e.target.value }))}
              placeholder="e.g. supabase-key-jkla"
            />
            {roleFormErrors.key ? <div className="text-destructive text-sm">{roleFormErrors.key}</div> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department_role_label">Label</Label>
            <Input
              id="department_role_label"
              value={roleForm.label}
              onChange={(e) => setRoleForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="e.g. Software Engineer"
            />
            {roleFormErrors.label ? <div className="text-destructive text-sm">{roleFormErrors.label}</div> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department_role_description">Description</Label>
            <Input
              id="department_role_description"
              value={roleForm.description}
              onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Role description"
            />
          </div>
        </div>
      </RightSidePanel>

      <RightSidePanel
        open={showDeleteRolePanel}
        onOpenChange={setShowDeleteRolePanel}
        title="Delete department role"
        description="This action is permanent and cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteRolePanel(false)} disabled={roleDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRole}
              disabled={roleDeleting || deleteConfirmText !== "DELETE" || !roleToDelete}
            >
              Delete role
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {roleToDelete && (
            <div className="text-sm">
              Type <span className="font-medium">DELETE</span> to confirm deleting{" "}
              <span className="font-medium">{roleToDelete.display_name || roleToDelete.name || "this role"}</span>.
            </div>
          )}

          {roleToDelete && (activeCountByRole.get(roleToDelete.name) || 0) > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">⚠️ Warning:</span>
                This role has {activeCountByRole.get(roleToDelete.name)} active member(s). You must reassign all members
                before deleting this role.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete_role_confirm">Confirm</Label>
            <Input
              id="delete_role_confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={roleDeleting}
            />
          </div>
        </div>
      </RightSidePanel>
    </Card>
  )
}
