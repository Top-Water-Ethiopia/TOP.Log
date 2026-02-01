"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Pencil, Trash2, Shield, Loader2, RefreshCw } from "lucide-react"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { toast } from "sonner"
import { PaginatedTable } from "@/components/ui/paginated-table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type Role = {
  id: string
  name: string
  description?: string | null
  department_id?: string | null
  department?: Department | null
}

type Department = {
  id: string
  name: string
  is_active?: boolean
}

type DepartmentRoleRow = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
}

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

const SYSTEM_ROLE_IDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000010",
])

export function RoleManager() {
  const { profile: currentProfile } = useSupabaseAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [roleFilter, setRoleFilter] = useState<"system" | "department">("system")
  const lastLoadErrorRef = useRef<string | null>(null)
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID

  const [searchQuery] = useState("")

  const rolesKey = isAdmin ? "/api/admin/roles" : null
  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
    isValidating: isRolesValidating,
    mutate: mutateRoles,
  } = useSWR<{ data: Role[] }>(rolesKey)

  const departmentsKey = isAdmin ? "/api/admin/departments" : null
  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
    mutate: mutateDepartments,
  } = useSWR<{ data: Department[] }>(departmentsKey)

  const departmentRolesKey = isAdmin ? "/api/admin/department-roles" : null
  const {
    data: departmentRolesResponse,
    error: departmentRolesError,
    isLoading: isDepartmentRolesLoading,
    mutate: mutateDepartmentRoles,
  } = useSWR<{ data: DepartmentRoleRow[] }>(departmentRolesKey, (url: string) =>
    apiFetch<{ data: DepartmentRoleRow[] }>(url)
  )

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])
  const departments = useMemo(() => {
    const rows = departmentsResponse?.data || []
    return rows.filter((d) => d.is_active !== false)
  }, [departmentsResponse])

  const isLoading = isRolesLoading || isDepartmentsLoading

  useEffect(() => {
    const error = rolesError || departmentsError || departmentRolesError
    if (!error) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(error, "Failed to load roles")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast.error(message)
  }, [rolesError, departmentsError, departmentRolesError])

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: "department" as "department" | "global",
    department_id: "",
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    const name = formData.name.trim()
    if (!name) {
      errors.name = "Role name is required"
    } else if (!/^[a-z0-9-]+$/.test(name)) {
      errors.name = "Role name must be lowercase alphanumeric with hyphens only"
    }

    if (formData.scope === "department") {
      if (!formData.department_id) {
        errors.department_id = "Department is required"
      } else if (!departments.find((d) => d.id === formData.department_id)) {
        errors.department_id = "Invalid department selected"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim().toLowerCase(),
        description: formData.description.trim() || null,
        department_id: formData.scope === "global" ? null : formData.department_id || null,
      }

      await apiFetch<{ data: Role }>("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      toast.success("Role created")
      setShowCreateDialog(false)
      resetForm()
      await mutateRoles()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create role"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingRole) return
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      const payload = {
        id: editingRole.id,
        name: formData.name.trim().toLowerCase(),
        description: formData.description.trim() || null,
        department_id: formData.scope === "global" ? null : formData.department_id || null,
      }

      await apiFetch<{ data: Role }>("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      toast.success("Role updated")
      setShowEditPanel(false)
      setEditingRole(null)
      await mutateRoles()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update role"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!roleToDelete) return
    setIsSubmitting(true)
    try {
      await apiFetch<{ success: boolean }>(`/api/admin/roles?id=${encodeURIComponent(roleToDelete.id)}`, {
        method: "DELETE",
      })

      toast.success("Role deleted")
      setShowDeleteDialog(false)
      setRoleToDelete(null)
      await mutateRoles()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete role"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      scope: "department",
      department_id: "",
    })
    setFormErrors({})
  }

  const openEditDialog = (role: Role) => {
    const scope = role.department_id ? "department" : "global"
    setEditingRole(role)
    setFormData({
      name: role.name || "",
      description: role.description || "",
      scope,
      department_id: role.department_id || "",
    })
    setFormErrors({})
    setShowEditPanel(true)
  }

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role)
    setShowDeleteDialog(true)
  }

  // Get all roles for display
  const isSystemRole = (role: Role) => {
    if (SYSTEM_ROLE_IDS.has(role.id)) return true
    return ["admin", "system-admin", "user"].includes(role.name)
  }

  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((r) => {
      const deptName = r.department?.name || ""
      const haystack = `${r.name} ${r.description || ""} ${deptName}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [roles, searchQuery])

  const systemRoles = useMemo(() => filteredRoles.filter(isSystemRole), [filteredRoles])
  const departmentRoles = useMemo(() => departmentRolesResponse?.data ?? [], [departmentRolesResponse])

  const renderRolesTable = (rolesToRender: Role[], emptyMessage = "No roles found. Create your first role.") => {
    const columns = [
      {
        key: "name",
        header: "Name",
        cell: (role: Role) => <span className="font-medium">{role.name}</span>,
      },
      {
        key: "department",
        header: "Department",
        cell: (role: Role) => {
          const departmentName = role.department?.name || (role.department_id ? role.department_id : "System-wide")
          return departmentName
        },
      },
      {
        key: "description",
        header: "Description",
        cell: (role: Role) => (
          <span className="hidden leading-relaxed wrap-break-word whitespace-normal lg:table-cell">
            {role.description || ""}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (role: Role) => {
          const system = isSystemRole(role)
          return (
            <div className="inline-flex items-center gap-2">
              <Shield className="text-muted-foreground h-4 w-4" />
              {system ? "System" : "Custom"}
            </div>
          )
        },
      },
      {
        key: "actions",
        header: "Actions",
        cell: (role: Role) => {
          const system = isSystemRole(role)
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  openEditDialog(role)
                }}
                disabled={system}
                aria-label={`Edit role ${role.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  openDeleteDialog(role)
                }}
                disabled={system}
                aria-label={`Delete role ${role.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ]

    return (
      <PaginatedTable
        data={rolesToRender}
        emptyMessage={emptyMessage}
        pageSize={10}
        searchPlaceholder="Search roles..."
        searchKeys={["name", "description"]}
        rowHref={(role) => `/admin/role-and-access/${encodeURIComponent(role.id)}/permissions`}
        columns={columns}
      />
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-0">
      {!isAdmin ? (
        <div className="text-muted-foreground py-8 text-center">You don't have permission to manage roles.</div>
      ) : isLoading ? (
        <div className="space-y-4 border-red-600">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-32 bg-gray-200/80 dark:bg-gray-800" />
              <Skeleton className="h-4 w-96 bg-gray-200/70 dark:bg-gray-800" />
            </div>
            <Skeleton className="h-10 w-32 bg-gray-200/80 dark:bg-gray-800" />
          </div>

          <div className="rounded-lg border">
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48 bg-gray-200/70 dark:bg-gray-800" />
                    <Skeleton className="h-3 w-72 bg-gray-200/60 dark:bg-gray-800" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                    <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Tabs value={roleFilter} onValueChange={(value) => setRoleFilter(value as "system" | "department")}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* <div>
                  <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Manage system roles and create custom roles assigned to departments.
                  </p>
                </div> */}
              <TabsList className="grid w-full max-w-lg grid-cols-2">
                <TabsTrigger value="system">System ({systemRoles.length})</TabsTrigger>
                <TabsTrigger value="department">Department Roles ({departmentRoles.length})</TabsTrigger>
              </TabsList>

              <div className="flex w-full justify-start gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => Promise.all([mutateRoles(), mutateDepartments(), mutateDepartmentRoles()])}
                  disabled={isRolesValidating}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRolesValidating ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <TabsContent value="system" className="mt-0">
              {renderRolesTable(systemRoles, "No system roles found.")}
            </TabsContent>

            <TabsContent value="department" className="mt-0">
              <DepartmentRolesManager
                roles={departmentRoles}
                departments={departments}
                isLoading={isDepartmentRolesLoading}
                error={departmentRolesError}
                mutate={mutateDepartmentRoles}
              />
            </TabsContent>
          </Tabs>

          <RightSidePanel
            open={showCreateDialog}
            onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (!open) {
                setFormErrors({})
                resetForm()
              }
            }}
            title="Create Role"
            description="Create a new custom role. Roles can be system-wide or assigned to a department."
            footer={
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" form="create-role-form" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            }
          >
            <form
              id="create-role-form"
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate()
              }}
            >
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., senior-engineer"
                    disabled={
                      !!editingRole &&
                      (editingRole.name === "admin" ||
                        editingRole.name === "system-admin" ||
                        editingRole.name === "user")
                    }
                  />
                  <p className="text-muted-foreground text-xs">Lowercase alphanumeric with hyphens only</p>
                  {formErrors.name && <p className="text-destructive text-sm">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope">
                    Scope <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.scope}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        scope: value as "department" | "global",
                        department_id: value === "global" ? "" : prev.department_id,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">System-wide</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    System-wide roles are not tied to any single department
                  </p>
                </div>

                {formData.scope === "department" ? (
                  <div className="space-y-2">
                    <Label htmlFor="department">
                      Department <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.department_id || ""}
                      onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department (required)" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length > 0 ? (
                          departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__no_departments__" disabled>
                            No departments available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {formErrors.department_id && <p className="text-destructive text-sm">{formErrors.department_id}</p>}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Role description"
                    rows={3}
                  />
                </div>
              </div>
            </form>
          </RightSidePanel>

          <RightSidePanel
            open={showEditPanel}
            onOpenChange={(open) => {
              setShowEditPanel(open)
              if (!open) {
                setEditingRole(null)
                setFormErrors({})
              }
            }}
            title="Edit Role"
            description="Update role information."
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditPanel(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="edit_name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., senior-engineer"
                  disabled={
                    !!editingRole &&
                    (editingRole.name === "admin" || editingRole.name === "system-admin" || editingRole.name === "user")
                  }
                />
                <p className="text-muted-foreground text-xs">Lowercase alphanumeric with hyphens only</p>
                {formErrors.name && <p className="text-destructive text-sm">{formErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_scope">
                  Scope <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      scope: value as "department" | "global",
                      department_id: value === "global" ? "" : prev.department_id,
                    }))
                  }
                  disabled={
                    !!editingRole &&
                    (editingRole.name === "admin" || editingRole.name === "system-admin" || editingRole.name === "user")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">System-wide</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">System-wide roles are not tied to any single department</p>
              </div>

              {formData.scope === "department" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit_department">
                    Department <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.department_id || ""}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department (required)" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.length > 0 ? (
                        departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no_departments__" disabled>
                          No departments available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.department_id && <p className="text-destructive text-sm">{formErrors.department_id}</p>}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Role description"
                  rows={3}
                />
              </div>
            </div>
          </RightSidePanel>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the role "{roleToDelete?.name}". This action cannot be undone. Make sure
                  no users are assigned to this role.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}

type DepartmentRoleDraft = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
}

type PermissionDefinition = {
  id: string
  resource: string
  action: string
  name: string
  description: string | null
}

type DepartmentRolePermissionRow = {
  id: string
  department_id: string | null
  department_role: string
  resource: string
  action: string
  effect: string
  created_at: string
  updated_at: string
}

function normalizeDepartmentRoleDraft(role: DepartmentRoleRow): DepartmentRoleDraft {
  return {
    key: role.key,
    label: role.label,
    sort_order: role.sort_order,
    is_active: role.is_active,
    is_default: role.is_default,
  }
}

function groupKey(name: string) {
  const [resource] = name.split(".")
  return resource || "other"
}

function DepartmentRolesManager({
  roles,
  departments,
  isLoading,
  error,
  mutate,
}: {
  roles: DepartmentRoleRow[]
  departments: Department[]
  isLoading: boolean
  error: unknown
  mutate: () => Promise<unknown>
}) {
  const defsKey = "/api/admin/permission-definitions"
  const { data: defsResponse } = useSWR<{ data: PermissionDefinition[] }>(defsKey)

  const defaultsKey = "/api/admin/department-role-permissions/defaults"
  const {
    data: defaultsResponse,
    mutate: mutateDefaults,
    isLoading: isDefaultsLoading,
    error: defaultsError,
  } = useSWR<{ data: DepartmentRolePermissionRow[] }>(defaultsKey)

  const [draftsByKey, setDraftsByKey] = useState<Record<string, DepartmentRoleDraft>>({})
  const [dirtyByKey, setDirtyByKey] = useState<Record<string, boolean>>({})

  const [showCreatePanel, setShowCreatePanel] = useState(false)

  const [createKey, setCreateKey] = useState("")
  const [createLabel, setCreateLabel] = useState("")
  const [createSortOrder, setCreateSortOrder] = useState("0")
  const [createIsActive, setCreateIsActive] = useState(true)
  const [createIsDefault, setCreateIsDefault] = useState(false)
  const [createDefaultCanAnswer, setCreateDefaultCanAnswer] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [savingByKey, setSavingByKey] = useState<Record<string, boolean>>({})
  const [deletingByKey, setDeletingByKey] = useState<Record<string, boolean>>({})

  const [selectedDefaultsRole, setSelectedDefaultsRole] = useState<string>("")
  const [defaultsQuery, setDefaultsQuery] = useState<string>("")
  const [isSavingDefaultByName, setIsSavingDefaultByName] = useState<Record<string, boolean>>({})

  const [selectedOverrideDepartmentId, setSelectedOverrideDepartmentId] = useState<string>("")
  const [selectedOverrideRole, setSelectedOverrideRole] = useState<string>("")
  const [overridesQuery, setOverridesQuery] = useState<string>("")
  const [isSavingOverrideByName, setIsSavingOverrideByName] = useState<Record<string, boolean>>({})

  const [expandedDefaultsGroups, setExpandedDefaultsGroups] = useState<string[]>([])
  const [expandedOverridesGroups, setExpandedOverridesGroups] = useState<string[]>([])

  const resetCreateForm = () => {
    setCreateKey("")
    setCreateLabel("")
    setCreateSortOrder("0")
    setCreateIsActive(true)
    setCreateIsDefault(false)
    setCreateDefaultCanAnswer(false)
  }

  useEffect(() => {
    setDraftsByKey((prev) => {
      const next = { ...prev }
      for (const role of roles) {
        const key = role.key
        const isDirty = !!dirtyByKey[key]
        if (!next[key] || !isDirty) {
          next[key] = normalizeDepartmentRoleDraft(role)
        }
      }
      return next
    })
  }, [roles, dirtyByKey])

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const so = a.sort_order - b.sort_order
      if (so !== 0) return so
      return a.key.localeCompare(b.key)
    })
  }, [roles])

  useEffect(() => {
    if (selectedDefaultsRole) return
    const firstActive = sortedRoles.find((r) => r.is_active)
    if (firstActive?.key) setSelectedDefaultsRole(firstActive.key)
  }, [selectedDefaultsRole, sortedRoles])

  useEffect(() => {
    if (selectedOverrideRole) return
    const firstActive = sortedRoles.find((r) => r.is_active)
    if (firstActive?.key) setSelectedOverrideRole(firstActive.key)
  }, [selectedOverrideRole, sortedRoles])

  useEffect(() => {
    if (selectedOverrideDepartmentId) return
    const firstDept = departments[0]
    if (firstDept?.id) setSelectedOverrideDepartmentId(firstDept.id)
  }, [departments, selectedOverrideDepartmentId])

  const allDefs = useMemo(() => {
    const defs = defsResponse?.data ?? []
    const scoped = defs.filter(
      (d) =>
        d.name === "department_questions.answer" ||
        d.name === "department_questions.read" ||
        d.name.startsWith("departments.") ||
        d.name.startsWith("departments.members.")
    )

    const q = defaultsQuery.trim().toLowerCase()
    let filtered = scoped
    if (q) {
      filtered = scoped.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q)
      )
    }

    // Group permissions by resource
    const groups = new Map<string, PermissionDefinition[]>()
    filtered.forEach((p) => {
      const key = groupKey(p.name)
      const current = groups.get(key) || []
      current.push(p)
      groups.set(key, current)
    })

    return Array.from(groups.entries())
      .map(([key, perms]) => [key, perms.sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [defsResponse, defaultsQuery])

  const overrideDefs = useMemo(() => {
    const defs = defsResponse?.data ?? []
    const scoped = defs.filter(
      (d) =>
        d.name === "department_questions.answer" ||
        d.name === "department_questions.read" ||
        d.name.startsWith("departments.") ||
        d.name.startsWith("departments.members.")
    )

    const q = overridesQuery.trim().toLowerCase()
    let filtered = scoped
    if (q) {
      filtered = scoped.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q)
      )
    }

    // Group permissions by resource
    const groups = new Map<string, PermissionDefinition[]>()
    filtered.forEach((p) => {
      const key = groupKey(p.name)
      const current = groups.get(key) || []
      current.push(p)
      groups.set(key, current)
    })

    return Array.from(groups.entries())
      .map(([key, perms]) => [key, perms.sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [defsResponse, overridesQuery])

  const defaultsRows = useMemo(() => defaultsResponse?.data ?? [], [defaultsResponse])

  const overridesKey = useMemo(() => {
    if (!selectedOverrideDepartmentId) return null
    return `/api/admin/departments/${encodeURIComponent(selectedOverrideDepartmentId)}/role-permissions`
  }, [selectedOverrideDepartmentId])

  const {
    data: overridesResponse,
    mutate: mutateOverrides,
    isLoading: isOverridesLoading,
    error: overridesError,
  } = useSWR<{ data: DepartmentRolePermissionRow[] }>(overridesKey, (url: string) =>
    apiFetch<{ data: DepartmentRolePermissionRow[] }>(url)
  )

  const overrideRows = useMemo(() => overridesResponse?.data ?? [], [overridesResponse])

  const overrideRowByName = useMemo(() => {
    const m = new Map<string, DepartmentRolePermissionRow>()
    for (const row of overrideRows) {
      if (!selectedOverrideDepartmentId) continue
      if (row.department_id !== selectedOverrideDepartmentId) continue
      if (row.department_role !== selectedOverrideRole) continue
      const name = `${row.resource}.${row.action}`
      m.set(name, row)
    }
    return m
  }, [overrideRows, selectedOverrideDepartmentId, selectedOverrideRole])

  const getOverrideEffect = useMemo(() => {
    return (name: string): "inherit" | "allow" | "deny" => {
      const row = overrideRowByName.get(name)
      if (!row) return "inherit"
      const eff = String(row.effect || "").toLowerCase()
      if (eff === "deny") return "deny"
      return "allow"
    }
  }, [overrideRowByName])

  const setOverrideEffect = async (def: PermissionDefinition, nextEffect: "inherit" | "allow" | "deny") => {
    if (!overridesKey) return
    if (!selectedOverrideDepartmentId || !selectedOverrideRole) return

    const name = def.name
    if (isSavingOverrideByName[name]) return

    try {
      setIsSavingOverrideByName((prev) => ({ ...prev, [name]: true }))
      const existing = overrideRowByName.get(name)

      if (nextEffect === "allow" || nextEffect === "deny") {
        if (existing?.id) {
          await apiFetch(overridesKey, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existing.id,
              department_role: selectedOverrideRole,
              resource: def.resource,
              action: def.action,
              effect: nextEffect,
            }),
          })
        } else {
          await apiFetch(overridesKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              department_role: selectedOverrideRole,
              resource: def.resource,
              action: def.action,
              effect: nextEffect,
            }),
          })
        }
      } else {
        if (existing?.id) {
          await apiFetch(`${overridesKey}?id=${encodeURIComponent(existing.id)}`, { method: "DELETE" })
        }
      }

      await mutateOverrides()
      toast.success("Department overrides updated")
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update department overrides"))
    } finally {
      setIsSavingOverrideByName((prev) => ({ ...prev, [name]: false }))
    }
  }

  const defaultRowByName = useMemo(() => {
    const m = new Map<string, DepartmentRolePermissionRow>()
    for (const row of defaultsRows) {
      if (row.department_id !== null) continue
      if (row.department_role !== selectedDefaultsRole) continue
      const name = `${row.resource}.${row.action}`
      m.set(name, row)
    }
    return m
  }, [defaultsRows, selectedDefaultsRole])

  const getDefaultEffect = useMemo(() => {
    return (name: string): "none" | "allow" | "deny" => {
      const row = defaultRowByName.get(name)
      if (!row) return "none"
      const eff = String(row.effect || "").toLowerCase()
      if (eff === "deny") return "deny"
      return "allow"
    }
  }, [defaultRowByName])

  const setDefaultPermissionEffect = async (def: PermissionDefinition, nextEffect: "none" | "allow" | "deny") => {
    if (!selectedDefaultsRole) return
    const name = def.name
    if (isSavingDefaultByName[name]) return

    try {
      setIsSavingDefaultByName((prev) => ({ ...prev, [name]: true }))
      const existing = defaultRowByName.get(name)

      if (nextEffect === "allow" || nextEffect === "deny") {
        await apiFetch(defaultsKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            department_role: selectedDefaultsRole,
            resource: def.resource,
            action: def.action,
            effect: nextEffect,
          }),
        })
      } else {
        if (existing?.id) {
          await apiFetch(`${defaultsKey}?id=${encodeURIComponent(existing.id)}`, { method: "DELETE" })
        }
      }

      await mutateDefaults()
      toast.success("Default permissions updated")
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update default permissions"))
    } finally {
      setIsSavingDefaultByName((prev) => ({ ...prev, [name]: false }))
    }
  }

  const updateDraft = (key: string, updater: (prev: DepartmentRoleDraft) => DepartmentRoleDraft) => {
    setDraftsByKey((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      return { ...prev, [key]: updater(existing) }
    })
    setDirtyByKey((prev) => ({ ...prev, [key]: true }))
  }

  const handleCreate = async () => {
    const key = createKey.trim()
    const label = createLabel.trim()

    if (!key) {
      toast.error("Key is required")
      return
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast.error("Key must be lowercase letters, numbers, and underscores only")
      return
    }
    if (!label) {
      toast.error("Label is required")
      return
    }

    const sort_order = Number(createSortOrder)
    if (!Number.isFinite(sort_order)) {
      toast.error("Sort order must be a number")
      return
    }

    try {
      setIsCreating(true)
      await apiFetch("/api/admin/department-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          label,
          sort_order,
          is_active: createIsActive,
          is_default: createIsDefault,
        }),
      })
      await mutate()
      resetCreateForm()
      setShowCreatePanel(false)
      toast.success("Department role created")
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to create role"))
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async (key: string) => {
    const draft = draftsByKey[key]
    if (!draft) return

    try {
      setSavingByKey((prev) => ({ ...prev, [key]: true }))
      await apiFetch("/api/admin/department-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: draft.key,
          label: draft.label,
          sort_order: draft.sort_order,
          is_active: draft.is_active,
          is_default: draft.is_default,
        }),
      })
      setDirtyByKey((prev) => ({ ...prev, [key]: false }))
      await mutate()
      toast.success("Role updated")
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update role"))
    } finally {
      setSavingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleDelete = async (key: string) => {
    const confirmed = window.confirm(`Delete department role "${key}"?`)
    if (!confirmed) return

    try {
      setDeletingByKey((prev) => ({ ...prev, [key]: true }))
      await apiFetch(`/api/admin/department-roles?key=${encodeURIComponent(key)}`, { method: "DELETE" })
      setDirtyByKey((prev) => ({ ...prev, [key]: false }))
      setDraftsByKey((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      await mutate()
      toast.success("Role deleted")
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to delete role"))
    } finally {
      setDeletingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department roles</CardTitle>
          <CardDescription>Manage Department Access Control roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department roles</CardTitle>
          <CardDescription>{getErrorMessage(error, "Failed to load department roles")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void mutate()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Department role defaults</CardTitle>
          <CardDescription>Configure the default permission set applied across all departments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <div className="text-sm font-medium">Department role</div>
              <Select value={selectedDefaultsRole} onValueChange={setSelectedDefaultsRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-sm font-medium">Search permissions</div>
              <Input value={defaultsQuery} onChange={(e) => setDefaultsQuery(e.target.value)} placeholder="Search..." />
            </div>
          </div>

          {defaultsError ? (
            <div className="text-muted-foreground text-sm">
              {getErrorMessage(defaultsError, "Failed to load defaults")}
            </div>
          ) : null}

          {isDefaultsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            </div>
          ) : allDefs.length === 0 ? (
            <div className="text-muted-foreground text-sm">No department permissions found in the catalog.</div>
          ) : (
            <div className="space-y-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {allDefs.reduce((total, [, perms]) => total + perms.length, 0)} permissions in {allDefs.length} groups
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedDefaultsGroups(allDefs.map(([group]) => group))}
                    disabled={expandedDefaultsGroups.length === allDefs.length}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedDefaultsGroups([])}
                    disabled={expandedDefaultsGroups.length === 0}
                  >
                    Collapse All
                  </Button>
                </div>
              </div>
              <Accordion
                type="multiple"
                value={expandedDefaultsGroups}
                onValueChange={setExpandedDefaultsGroups}
                className="rounded-lg border"
              >
                {allDefs.map(([group, perms]) => (
                  <AccordionItem key={group} value={group} className="px-4">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-4">
                        <div className="font-medium">{group}</div>
                        <div className="text-muted-foreground text-sm">{perms.length}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="divide-y rounded-lg border">
                        {perms.map((d) => {
                          const currentEffect = getDefaultEffect(d.name)
                          const saving = !!isSavingDefaultByName[d.name]
                          return (
                            <div key={d.id} className="flex items-center justify-between gap-4 p-3">
                              <div className="min-w-0 pl-4">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="bg-muted-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
                                  <div className="truncate font-medium">{d.action}</div>
                                </div>
                                {d.description ? (
                                  <div className="text-muted-foreground truncate text-sm">{d.description}</div>
                                ) : null}
                              </div>
                              <Select
                                value={currentEffect}
                                onValueChange={(v) =>
                                  void setDefaultPermissionEffect(d, v as "none" | "allow" | "deny")
                                }
                                disabled={!selectedDefaultsRole || saving}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="allow">Allow</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Department overrides</CardTitle>
          <CardDescription>Override defaults for a specific department (deny overrides allow).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Department</div>
              <Select value={selectedOverrideDepartmentId} onValueChange={setSelectedOverrideDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Department role</div>
              <Select value={selectedOverrideRole} onValueChange={setSelectedOverrideRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Search permissions</div>
              <Input
                value={overridesQuery}
                onChange={(e) => setOverridesQuery(e.target.value)}
                placeholder="Search..."
              />
            </div>
          </div>

          {overridesError ? (
            <div className="text-muted-foreground text-sm">
              {getErrorMessage(overridesError, "Failed to load overrides")}
            </div>
          ) : null}

          {!selectedOverrideDepartmentId ? (
            <div className="text-muted-foreground text-sm">Select a department to edit overrides.</div>
          ) : isOverridesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            </div>
          ) : overrideDefs.length === 0 ? (
            <div className="text-muted-foreground text-sm">No department permissions found in the catalog.</div>
          ) : (
            <div className="space-y-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {overrideDefs.reduce((total, [, perms]) => total + perms.length, 0)} permissions in{" "}
                  {overrideDefs.length} groups
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedOverridesGroups(overrideDefs.map(([group]) => group))}
                    disabled={expandedOverridesGroups.length === overrideDefs.length}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedOverridesGroups([])}
                    disabled={expandedOverridesGroups.length === 0}
                  >
                    Collapse All
                  </Button>
                </div>
              </div>
              <Accordion
                type="multiple"
                value={expandedOverridesGroups}
                onValueChange={setExpandedOverridesGroups}
                className="rounded-lg border"
              >
                {overrideDefs.map(([group, perms]) => (
                  <AccordionItem key={group} value={group} className="px-4">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-4">
                        <div className="font-medium">{group}</div>
                        <div className="text-muted-foreground text-sm">{perms.length}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="divide-y rounded-lg border">
                        {perms.map((d) => {
                          const currentEffect = getOverrideEffect(d.name)
                          const saving = !!isSavingOverrideByName[d.name]
                          return (
                            <div key={d.id} className="flex items-center justify-between gap-4 p-3">
                              <div className="min-w-0 pl-4">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="bg-muted-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
                                  <div className="truncate font-medium">{d.action}</div>
                                </div>
                                {d.description ? (
                                  <div className="text-muted-foreground truncate text-sm">{d.description}</div>
                                ) : null}
                              </div>
                              <Select
                                value={currentEffect}
                                onValueChange={(v) => void setOverrideEffect(d, v as "inherit" | "allow" | "deny")}
                                disabled={!selectedOverrideRole || saving}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue placeholder="Override" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit">Inherit</SelectItem>
                                  <SelectItem value="allow">Allow</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {overridesKey ? (
            <Button variant="outline" onClick={() => void mutateOverrides()}>
              Refresh overrides
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setShowCreatePanel(true)}>Create Department Role</Button>
      </div>

      <RightSidePanel
        open={showCreatePanel}
        onOpenChange={(open) => {
          setShowCreatePanel(open)
          if (!open) resetCreateForm()
        }}
        title="Create department role"
        description="Add a new Department Access Control role."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setShowCreatePanel(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" form="create-department-role-form" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        }
      >
        <form
          id="create-department-role-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <div className="space-y-4 pt-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Key</div>
                <Input
                  value={createKey}
                  onChange={(e) => setCreateKey(e.target.value)}
                  placeholder="e.g. department_lead"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Label</div>
                <Input
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="e.g. Department Lead"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Sort order</div>
                <Input
                  value={createSortOrder}
                  onChange={(e) => setCreateSortOrder(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm font-medium">Active</div>
                  <Switch checked={createIsActive} onCheckedChange={(v: boolean) => setCreateIsActive(v)} />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm font-medium">Default role</div>
                  <Switch checked={createIsDefault} onCheckedChange={(v: boolean) => setCreateIsDefault(v)} />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm font-medium">Default can answer department questions</div>
                  <Switch
                    checked={createDefaultCanAnswer}
                    onCheckedChange={(v: boolean) => setCreateDefaultCanAnswer(v)}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </RightSidePanel>

      <Card>
        <CardHeader>
          <CardTitle>Department roles</CardTitle>
          <CardDescription>Edit or delete Department Access Control roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedRoles.length === 0 ? (
            <div className="text-muted-foreground text-sm">No roles found.</div>
          ) : (
            <div className="space-y-3">
              {sortedRoles.map((r) => {
                const draft = draftsByKey[r.key] ?? normalizeDepartmentRoleDraft(r)
                const dirty = !!dirtyByKey[r.key]
                const saving = !!savingByKey[r.key]
                const deleting = !!deletingByKey[r.key]

                return (
                  <div key={r.key} className="space-y-3 rounded-xl border p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Key</div>
                        <Input value={draft.key} disabled />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Label</div>
                        <Input
                          value={draft.label}
                          onChange={(e) => updateDraft(r.key, (prev) => ({ ...prev, label: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Sort order</div>
                        <Input
                          value={String(draft.sort_order)}
                          onChange={(e) =>
                            updateDraft(r.key, (prev) => ({
                              ...prev,
                              sort_order: Number.isFinite(Number(e.target.value))
                                ? Number(e.target.value)
                                : prev.sort_order,
                            }))
                          }
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="text-sm font-medium">Active</div>
                          <Switch
                            checked={draft.is_active}
                            onCheckedChange={(v: boolean) => updateDraft(r.key, (prev) => ({ ...prev, is_active: v }))}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="text-sm font-medium">Default role</div>
                          <Switch
                            checked={draft.is_default}
                            onCheckedChange={(v: boolean) => updateDraft(r.key, (prev) => ({ ...prev, is_default: v }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleSave(r.key)}
                        disabled={!dirty || saving || deleting}
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDelete(r.key)}
                        disabled={saving || deleting}
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Button variant="outline" onClick={() => void mutate()}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
