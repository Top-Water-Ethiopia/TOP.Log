"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { Checkbox } from "@/components/ui/checkbox"

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

type DepartmentAccessLevelRow = {
  id: string
  name: string
  display_name: string
  description: string | null
  level: number
  is_active: boolean
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

  const accessLevelsKey = isAdmin ? "/api/admin/department-access-levels" : null
  const {
    data: accessLevelsResponse,
    error: accessLevelsError,
    isLoading: isAccessLevelsLoading,
    mutate: mutateAccessLevels,
  } = useSWR<{ data: DepartmentAccessLevelRow[] }>(accessLevelsKey, (url: string) =>
    apiFetch<{ data: DepartmentAccessLevelRow[] }>(url)
  )

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])
  const departments = useMemo(() => {
    const rows = departmentsResponse?.data || []
    return rows.filter((d) => d.is_active !== false)
  }, [departmentsResponse])

  const isLoading = isRolesLoading || isDepartmentsLoading

  useEffect(() => {
    const error = rolesError || departmentsError || accessLevelsError
    if (!error) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(error, "Failed to load roles")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast.error(message)
  }, [rolesError, departmentsError, accessLevelsError])

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
  const departmentAccessLevels = useMemo(() => accessLevelsResponse?.data ?? [], [accessLevelsResponse])

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
                <TabsTrigger value="department">Department Access Levels ({departmentAccessLevels.length})</TabsTrigger>
              </TabsList>

              <div className="flex w-full justify-start gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => Promise.all([mutateRoles(), mutateDepartments(), mutateAccessLevels()])}
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
              <DepartmentAccessLevelsManager
                accessLevels={departmentAccessLevels}
                isLoading={isAccessLevelsLoading}
                error={accessLevelsError}
                mutate={async () => {
                  await mutateAccessLevels()
                }}
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

type PermissionDefinition = {
  id: string
  resource: string
  action: string
  name: string
  description: string | null
  scope: "system" | "department" | "both"
}

type AccessLevelPermissionRow = {
  id: string
  access_level_id: string
  permission_definition_id: string
  effect: string
  created_at: string
  updated_at: string
  department_access_levels: {
    name: string
    display_name: string
    level: number
  }
  permission_definitions: {
    id: string
    resource: string
    action: string
    description: string | null
    scope: string
  }
}

function groupKey(name: string) {
  const [resource] = name.split(".")
  return resource || "other"
}

function DepartmentAccessLevelsManager({
  accessLevels,
  isLoading,
  error,
  mutate,
}: {
  accessLevels: DepartmentAccessLevelRow[]
  isLoading: boolean
  error: unknown
  mutate: () => Promise<unknown>
}) {
  const defsKey = "/api/admin/permission-definitions"
  const { data: defsResponse } = useSWR<{ data: PermissionDefinition[] }>(defsKey)

  const defaultsKey = "/api/admin/department-access-level-permissions/defaults"
  const {
    data: defaultsResponse,
    mutate: mutateDefaults,
    isLoading: isDefaultsLoading,
    error: defaultsError,
  } = useSWR<{ data: AccessLevelPermissionRow[] }>(defaultsKey)

  // Load access levels for the dropdowns
  const [defaultsQuery, setDefaultsQuery] = useState<string>("")
  const [isSavingDefaultByName, setIsSavingDefaultByName] = useState<Record<string, boolean>>({})

  const [expandedDefaultsGroups, setExpandedDefaultsGroups] = useState<string[]>([])

  const [selectedDefaultsAccessLevel, setSelectedDefaultsAccessLevel] = useState<string>("")

  const sortedAccessLevels = useMemo(() => {
    return [...accessLevels].sort((a, b) => {
      const lv = a.level - b.level
      if (lv !== 0) return lv
      return a.name.localeCompare(b.name)
    })
  }, [accessLevels])

  useEffect(() => {
    if (selectedDefaultsAccessLevel) return
    const firstAccessLevel = sortedAccessLevels[0]
    if (firstAccessLevel?.id) setSelectedDefaultsAccessLevel(firstAccessLevel.id)
  }, [selectedDefaultsAccessLevel, sortedAccessLevels])

  const allDefs = useMemo(() => {
    const defs = defsResponse?.data ?? []
    // Filter to only show permissions valid for department scope
    const scoped = defs.filter((d) => d.scope === "department" || d.scope === "both")

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

  const defaultsRows = useMemo(() => defaultsResponse?.data ?? [], [defaultsResponse])

  const defaultRowByName = useMemo(() => {
    const m = new Map<string, AccessLevelPermissionRow>()
    for (const row of defaultsRows) {
      // For access level permissions, we don't filter by role
      // All access level permissions are shown as defaults
      const name = `${row.permission_definitions.resource}.${row.permission_definitions.action}`
      m.set(name, row)
    }
    return m
  }, [defaultsRows])

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
    const name = def.name
    if (isSavingDefaultByName[name]) return

    try {
      setIsSavingDefaultByName((prev) => ({ ...prev, [name]: true }))
      const existing = defaultRowByName.get(name)

      if (nextEffect === "allow" || nextEffect === "deny") {
        const accessLevelId = selectedDefaultsAccessLevel
        if (!accessLevelId) {
          throw new Error("Access level is required")
        }

        await apiFetch(defaultsKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_level_id: accessLevelId,
            permission_definition_id: def.id,
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department access levels</CardTitle>
          <CardDescription>Manage department access levels (permission sets).</CardDescription>
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
          <CardTitle>Department access levels</CardTitle>
          <CardDescription>{getErrorMessage(error, "Failed to load access levels")}</CardDescription>
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
          <CardTitle>Access level permissions</CardTitle>
          <CardDescription>Configure permissions per access level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <div className="text-sm font-medium">Access level</div>
              <Select value={selectedDefaultsAccessLevel} onValueChange={setSelectedDefaultsAccessLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an access level" />
                </SelectTrigger>
                <SelectContent>
                  {accessLevels.map((al) => (
                    <SelectItem key={al.id} value={al.id}>
                      {al.display_name || al.name}
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
                          const isAllowed = currentEffect === "allow"
                          return (
                            <label key={d.id} className="hover:bg-muted/40 flex items-center gap-3 p-3">
                              <Checkbox
                                checked={isAllowed}
                                disabled={!selectedDefaultsAccessLevel || saving}
                                onCheckedChange={(checked) =>
                                  void setDefaultPermissionEffect(d, checked ? "allow" : "none")
                                }
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{d.action}</div>
                                {d.description ? (
                                  <div className="text-muted-foreground truncate text-sm">{d.description}</div>
                                ) : null}
                              </div>
                            </label>
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
    </div>
  )
}
