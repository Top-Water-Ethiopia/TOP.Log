"use client"

import { useState, useEffect } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Shield, Loader2, Search, SlidersHorizontal, ArrowUpDown } from "lucide-react"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"

interface Department {
  id: string
  name: string
  code: string | null
  is_active: boolean
}

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
  created_at: string
  updated_at: string
}

interface RoleWithDepartment extends Role {
  department?: Department | null
}

export function RoleManager() {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth()
  const [roles, setRoles] = useState<RoleWithDepartment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [roleFilter, setRoleFilter] = useState<"all" | "system" | "custom">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [pageByFilter, setPageByFilter] = useState<Record<"all" | "system" | "custom", number>>({
    all: 1,
    system: 1,
    custom: 1,
  })
  const { toast } = useToast()

  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || isSuperAdmin

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    department_id: "",
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Load departments
      const deptResponse = await fetch("/api/admin/departments")
      const deptResult = await deptResponse.json()

      if (!deptResponse.ok) {
        throw new Error(deptResult.message || deptResult.error || "Failed to load departments")
      }

      setDepartments((deptResult.data || []).filter((d: Department) => d.is_active))

      // Load roles with departments
      const roleResponse = await fetch("/api/admin/roles")
      const roleResult = await roleResponse.json()

      if (!roleResponse.ok) {
        throw new Error(roleResult.message || roleResult.error || "Failed to load roles")
      }

      setRoles(roleResult.data || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to load roles and departments",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = "Role name is required"
    } else if (!/^[a-z0-9-]+$/.test(formData.name.trim())) {
      errors.name = "Role name must be lowercase alphanumeric with hyphens only"
    }

    // Custom roles must have a department assigned
    const isSystemRole =
      editingRole && (editingRole.name === "super-admin" || editingRole.name === "admin" || editingRole.name === "user")
    if (!isSystemRole && !formData.department_id) {
      errors.department_id = "Department is required for custom roles"
    }

    if (formData.department_id && !departments.find((d) => d.id === formData.department_id)) {
      errors.department_id = "Invalid department selected"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          department_id: formData.department_id || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to create role")
      }

      toast({
        title: "Success",
        description: "Role created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error("Error creating role:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to create role",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingRole || !validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingRole.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          department_id: formData.department_id || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update role")
      }

      toast({
        title: "Success",
        description: "Role updated successfully",
      })

      setEditingRole(null)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error("Error updating role:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to update role",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!roleToDelete) return

    // Prevent deleting system roles
    if (
      roleToDelete.id === SUPER_ADMIN_ROLE_ID ||
      roleToDelete.id === ADMIN_ROLE_ID ||
      roleToDelete.name === "super-admin" ||
      roleToDelete.name === "admin" ||
      roleToDelete.name === "user"
    ) {
      toast({
        title: "Cannot delete",
        description: "System roles cannot be deleted",
        variant: "destructive",
      })
      setShowDeleteDialog(false)
      setRoleToDelete(null)
      return
    }

    try {
      const response = await fetch(`/api/admin/roles?id=${roleToDelete.id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to delete role")
      }

      toast({
        title: "Success",
        description: "Role deleted successfully",
      })

      setShowDeleteDialog(false)
      setRoleToDelete(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting role:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to delete role",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      department_id: "",
    })
    setFormErrors({})
  }

  const openEditDialog = (role: Role) => {
    setEditingRole(role)
    setFormData({
      name: role.name,
      description: role.description || "",
      department_id: role.department_id || "",
    })
    setShowCreateDialog(true)
  }

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role)
    setShowDeleteDialog(true)
  }

  // Filter roles based on type
  const filteredRoles = roles.filter((role) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true

    const haystack = [role.name, role.description || "", role.department?.name || "", role.department?.code || ""]
      .join(" ")
      .toLowerCase()

    return haystack.includes(q)
  })

  const isSystemRole = (role: RoleWithDepartment) =>
    role.id === SUPER_ADMIN_ROLE_ID ||
    role.id === ADMIN_ROLE_ID ||
    role.name === "super-admin" ||
    role.name === "admin" ||
    role.name === "user"

  const systemRoles = filteredRoles.filter((role) => isSystemRole(role))

  const customRoles = filteredRoles.filter((role) => !isSystemRole(role))

  const pageSize = 6

  const setCurrentPage = (filter: "all" | "system" | "custom", page: number) => {
    setPageByFilter((prev) => ({ ...prev, [filter]: page }))
  }

  const clampPage = (page: number, total: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return Math.min(Math.max(1, page), totalPages)
  }

  const paginate = <T,>(items: T[], requestedPage: number) => {
    const total = items.length
    const page = clampPage(requestedPage, total)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const startIndex = (page - 1) * pageSize
    const endIndexExclusive = Math.min(startIndex + pageSize, total)

    return {
      page,
      total,
      totalPages,
      start: total === 0 ? 0 : startIndex + 1,
      end: total === 0 ? 0 : endIndexExclusive,
      pageItems: items.slice(startIndex, endIndexExclusive),
    }
  }

  const PaginationFooter = ({ filter, total }: { filter: "all" | "system" | "custom"; total: number }) => {
    const page = clampPage(pageByFilter[filter], total)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1
    const end = total === 0 ? 0 : Math.min(page * pageSize, total)

    return (
      <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6">
        <div className="hidden sm:block">
          <p className="text-muted-foreground text-sm">
            Showing <span className="text-foreground font-medium">{start}</span> to{" "}
            <span className="text-foreground font-medium">{end}</span> of{" "}
            <span className="text-foreground font-medium">{total}</span> results
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={total === 0 || page <= 1}
            onClick={() => setCurrentPage(filter, page - 1)}
          >
            Prev
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1
              const active = p === page
              return (
                <Button
                  key={`${filter}-page-${p}`}
                  variant="outline"
                  size="sm"
                  disabled={total === 0}
                  className={active ? "border-primary bg-primary/10 text-primary" : ""}
                  onClick={() => setCurrentPage(filter, p)}
                >
                  {p}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={total === 0 || page >= totalPages}
            onClick={() => setCurrentPage(filter, page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  const allPagination = paginate(filteredRoles, pageByFilter.all)
  const systemPagination = paginate(systemRoles, pageByFilter.system)
  const customPagination = paginate(customRoles, pageByFilter.custom)

  useEffect(() => {
    const next = {
      all: clampPage(pageByFilter.all, allPagination.total),
      system: clampPage(pageByFilter.system, systemPagination.total),
      custom: clampPage(pageByFilter.custom, customPagination.total),
    }

    if (next.all !== pageByFilter.all || next.system !== pageByFilter.system || next.custom !== pageByFilter.custom) {
      setPageByFilter(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPagination.total, systemPagination.total, customPagination.total])

  useEffect(() => {
    setPageByFilter((prev) => ({ ...prev, [roleFilter]: 1 }))
  }, [roleFilter, searchQuery])

  // Helper function to render roles table
  const renderRolesTable = (
    rolesToRender: RoleWithDepartment[],
    emptyMessage = "No roles found. Create your first role."
  ) => {
    if (rolesToRender.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
            {emptyMessage}
          </TableCell>
        </TableRow>
      )
    }

    return (
      <>
        {rolesToRender.map((role) => {
          const isSystemRole =
            role.id === SUPER_ADMIN_ROLE_ID ||
            role.id === ADMIN_ROLE_ID ||
            role.name === "super-admin" ||
            role.name === "admin" ||
            role.name === "user"
          const isSuperAdminRole = role.id === SUPER_ADMIN_ROLE_ID || role.name === "super-admin"
          return (
            <TableRow key={role.id} className="group hover:bg-muted/50 transition-colors">
              <TableCell className="font-medium whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {role.name}
                  {isSystemRole && <Shield className="text-muted-foreground h-4 w-4" />}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {role.department ? (
                  <Badge variant="outline" className="bg-muted/30">
                    {role.department.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">{isSystemRole ? "System-wide" : "No department"}</span>
                )}
              </TableCell>
              <TableCell className="hidden max-w-md truncate lg:table-cell">{role.description || "-"}</TableCell>
              <TableCell>
                <Badge variant={isSystemRole ? (isSuperAdminRole ? "destructive" : "secondary") : "default"}>
                  {isSuperAdminRole ? "Super Admin" : isSystemRole ? "System" : "Custom"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {isSystemRole ? (
                    <span className="text-muted-foreground text-xs">Read-only</span>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(role)}>
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </>
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
                <div className="flex justify-end">
                   <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                {/* <div>
                  <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Manage system roles and create custom roles assigned to departments.
                  </p>
                </div> */}
                <TabsList className="bg-background h-auto rounded-lg border p-1 shadow-sm">
                  <TabsTrigger className="text-xs" value="all">
                    All Roles ({allPagination.total})
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="system">
                    System ({systemPagination.total})
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="custom">
                    Custom ({customPagination.total})
                  </TabsTrigger>
                </TabsList>
              </div>
         
</div>
            <div className="bg-card text-card-foreground mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border p-4 shadow-sm md:flex-row">
              <div className="relative w-full md:w-96">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roles..."
                  className="pl-9"
                />
              </div>
              <div className="flex w-full items-center gap-2 md:w-auto">
                <Button variant="outline" className="w-full md:w-auto">
                  <SlidersHorizontal className="text-muted-foreground mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Button variant="outline" className="w-full md:w-auto">
                  <ArrowUpDown className="text-muted-foreground mr-2 h-4 w-4" />
                  Sort
                </Button>
              </div>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Name
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Department
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden px-6 py-4 text-xs font-semibold tracking-wider uppercase lg:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Type
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-right text-xs font-semibold tracking-wider uppercase">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderRolesTable(
                      allPagination.pageItems,
                      searchQuery.trim() ? "No roles matched your search." : "No roles found. Create your first role."
                    )}
                  </TableBody>
                </Table>
                <PaginationFooter filter="all" total={allPagination.total} />
              </div>
            </TabsContent>

            <TabsContent value="system" className="mt-0">
              <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Name
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Department
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden px-6 py-4 text-xs font-semibold tracking-wider uppercase lg:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Type
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-right text-xs font-semibold tracking-wider uppercase">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderRolesTable(systemPagination.pageItems, "No system roles found.")}</TableBody>
                </Table>
                <PaginationFooter filter="system" total={systemPagination.total} />
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-0">
              <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Name
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Department
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden px-6 py-4 text-xs font-semibold tracking-wider uppercase lg:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-xs font-semibold tracking-wider uppercase">
                        Type
                      </TableHead>
                      <TableHead className="text-muted-foreground px-6 py-4 text-right text-xs font-semibold tracking-wider uppercase">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderRolesTable(
                      customPagination.pageItems,
                      "No custom roles found. Create your first custom role."
                    )}
                  </TableBody>
                </Table>
                <PaginationFooter filter="custom" total={customPagination.total} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="fixed right-8 bottom-8 z-50">
            <Button
              className="rounded-full px-5 py-6 shadow-lg"
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

          {/* Create/Edit Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
                <DialogDescription>
                  {editingRole
                    ? "Update custom role information"
                    : "Create a new custom role. Custom roles must be assigned to a department."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
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
                      (editingRole.name === "super-admin" ||
                        editingRole.name === "admin" ||
                        editingRole.name === "user")
                    }
                  />
                  <p className="text-muted-foreground text-xs">Lowercase alphanumeric with hyphens only</p>
                  {formErrors.name && <p className="text-destructive text-sm">{formErrors.name}</p>}
                </div>
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
                            {dept.name} {dept.code && `(${dept.code})`}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No departments available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">Custom roles must be assigned to a department</p>
                  {formErrors.department_id && <p className="text-destructive text-sm">{formErrors.department_id}</p>}
                </div>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={editingRole ? handleUpdate : handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingRole ? "Updating..." : "Creating..."}
                    </>
                  ) : editingRole ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
