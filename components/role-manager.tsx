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
import { Plus, Pencil, Trash2, Shield, Loader2, RefreshCw } from "lucide-react"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { toast } from "sonner"
import { PaginatedTable } from "@/components/ui/paginated-table"

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
  const [roleFilter, setRoleFilter] = useState<"all" | "system" | "custom">("all")
  const [pageByFilter, setPageByFilter] = useState<Record<"all" | "system" | "custom", number>>({
    all: 1,
    system: 1,
    custom: 1,
  })
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

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])
  const departments = useMemo(() => {
    const rows = departmentsResponse?.data || []
    return rows.filter((d) => d.is_active !== false)
  }, [departmentsResponse])

  const isLoading = isRolesLoading || isDepartmentsLoading

  useEffect(() => {
    const error = rolesError || departmentsError
    if (!error) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(error, "Failed to load roles")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast.error(message)
  }, [rolesError, departmentsError])

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
  const customRoles = useMemo(() => filteredRoles.filter((r) => !isSystemRole(r)), [filteredRoles])

  const pageSize = 10

  const clampPage = (page: number, total: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return Math.min(Math.max(1, page), totalPages)
  }

  const paginate = <T,>(items: T[], requestedPage: number) => {
    const total = items.length
    const safePage = clampPage(requestedPage, total)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const startIndex = (safePage - 1) * pageSize
    const endIndexExclusive = Math.min(startIndex + pageSize, total)

    return {
      page: safePage,
      total,
      totalPages,
      start: total === 0 ? 0 : startIndex + 1,
      end: total === 0 ? 0 : endIndexExclusive,
      pageItems: items.slice(startIndex, endIndexExclusive),
    }
  }

  const allPagination = paginate(filteredRoles, pageByFilter.all)
  const systemPagination = paginate(systemRoles, pageByFilter.system)
  const customPagination = paginate(customRoles, pageByFilter.custom)

  useEffect(() => {
    setPageByFilter((prev) => ({ ...prev, [roleFilter]: 1 }))
  }, [roleFilter])

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
        pageSize={pageSize}
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
          <Tabs value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | "system" | "custom")}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* <div>
                  <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Manage system roles and create custom roles assigned to departments.
                  </p>
                </div> */}
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="all">All Roles ({allPagination.total})</TabsTrigger>
                <TabsTrigger value="system">System ({systemPagination.total})</TabsTrigger>
                <TabsTrigger value="custom">Custom ({customPagination.total})</TabsTrigger>
              </TabsList>

              <div className="flex w-full justify-start gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => Promise.all([mutateRoles(), mutateDepartments()])}
                  disabled={isRolesValidating}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRolesValidating ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  onClick={() => {
                    resetForm()
                    setEditingRole(null)
                    setShowCreateDialog(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Role
                </Button>
              </div>
            </div>

            <TabsContent value="all" className="mt-0">
              {renderRolesTable(
                allPagination.pageItems,
                searchQuery.trim() ? "No roles matched your search." : "No roles found. Create your first role."
              )}
            </TabsContent>

            <TabsContent value="system" className="mt-0">
              {renderRolesTable(systemPagination.pageItems, "No system roles found.")}
            </TabsContent>

            <TabsContent value="custom" className="mt-0">
              {renderRolesTable(customPagination.pageItems, "No custom roles found. Create your first custom role.")}
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
