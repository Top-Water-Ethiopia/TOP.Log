"use client"

import { useState, useEffect } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Shield, Loader2 } from "lucide-react"

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
      const deptResponse = await fetch('/api/admin/departments')
      const deptResult = await deptResponse.json()
      
      if (!deptResponse.ok) {
        throw new Error(deptResult.message || deptResult.error || "Failed to load departments")
      }
      
      setDepartments((deptResult.data || []).filter((d: Department) => d.is_active))

      // Load roles with departments
      const roleResponse = await fetch('/api/admin/roles')
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
    const isSystemRole = editingRole && (editingRole.name === "super-admin" || editingRole.name === "admin" || editingRole.name === "user")
    if (!isSystemRole && !formData.department_id) {
      errors.department_id = "Department is required for custom roles"
    }

    if (formData.department_id && !departments.find(d => d.id === formData.department_id)) {
      errors.department_id = "Invalid department selected"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
    if (roleToDelete.id === SUPER_ADMIN_ROLE_ID || roleToDelete.id === ADMIN_ROLE_ID || roleToDelete.name === "super-admin" || roleToDelete.name === "admin" || roleToDelete.name === "user") {
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
        method: 'DELETE',
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

  if (!isAdmin) {
    return (
      <div className="text-center text-muted-foreground py-8">
        You don't have permission to manage roles.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32 bg-gray-200/80 dark:bg-gray-800" />
            <Skeleton className="h-4 w-96 bg-gray-200/70 dark:bg-gray-800" />
          </div>
          <Skeleton className="h-10 w-32 bg-gray-200/80 dark:bg-gray-800" />
        </div>

        <div className="border rounded-lg">
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-3 w-72 bg-gray-200/60 dark:bg-gray-800" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 bg-gray-200/70 dark:bg-gray-800 rounded" />
                  <Skeleton className="h-8 w-8 bg-gray-200/70 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Filter roles based on type
  const systemRoles = roles.filter(role => 
    role.id === SUPER_ADMIN_ROLE_ID || role.id === ADMIN_ROLE_ID || role.name === "super-admin" || role.name === "admin" || role.name === "user"
  )
  const customRoles = roles.filter(role => 
    role.id !== SUPER_ADMIN_ROLE_ID && role.id !== ADMIN_ROLE_ID && role.name !== "super-admin" && role.name !== "admin" && role.name !== "user"
  )

  // Helper function to render roles table
  const renderRolesTable = (rolesToRender: RoleWithDepartment[], emptyMessage = "No roles found. Create your first role.") => {
    if (rolesToRender.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
            {emptyMessage}
          </TableCell>
        </TableRow>
      )
    }

    return (
      <>
        {rolesToRender.map((role) => {
          const isSystemRole = role.id === SUPER_ADMIN_ROLE_ID || role.id === ADMIN_ROLE_ID || role.name === "super-admin" || role.name === "admin" || role.name === "user"
          const isSuperAdminRole = role.id === SUPER_ADMIN_ROLE_ID || role.name === "super-admin"
          return (
            <TableRow key={role.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {role.name}
                  {isSystemRole && <Shield className="h-4 w-4 text-muted-foreground" />}
                </div>
              </TableCell>
              <TableCell>
                {role.department ? (
                  <Badge variant="outline">{role.department.name}</Badge>
                ) : (
                  <span className="text-muted-foreground">
                    {isSystemRole ? "System-wide" : "No department"}
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-md truncate">
                {role.description || "-"}
              </TableCell>
              <TableCell>
                <Badge variant={isSystemRole ? (isSuperAdminRole ? "destructive" : "secondary") : "default"}>
                  {isSuperAdminRole ? "Super Admin" : isSystemRole ? "System" : "Custom"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {isSystemRole ? (
                    <span className="text-xs text-muted-foreground">Read-only</span>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(role)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(role)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Roles</h2>
          <p className="text-muted-foreground">
            Manage system roles and create custom roles assigned to departments.
          </p>
        </div>
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

      <Tabs value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | "system" | "custom")}>
        <TabsList>
          <TabsTrigger value="all">All Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="system">System ({systemRoles.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom ({customRoles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderRolesTable(roles)}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderRolesTable(systemRoles, "No system roles found.")}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderRolesTable(customRoles, "No custom roles found. Create your first custom role.")}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
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
                disabled={!!editingRole && (editingRole.name === "super-admin" || editingRole.name === "admin" || editingRole.name === "user")}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase alphanumeric with hyphens only
              </p>
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.department_id || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, department_id: value })
                }
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
              <p className="text-xs text-muted-foreground">
                Custom roles must be assigned to a department
              </p>
              {formErrors.department_id && (
                <p className="text-sm text-destructive">{formErrors.department_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Role description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCreateDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingRole ? handleUpdate : handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingRole ? "Updating..." : "Creating..."}
                </>
              ) : (
                editingRole ? "Update" : "Create"
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
              This will permanently delete the role "{roleToDelete?.name}".
              This action cannot be undone. Make sure no users are assigned to this role.
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
    </div>
  )
}


