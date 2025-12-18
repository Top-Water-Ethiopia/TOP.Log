"use client"

import { useState, useEffect } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"

interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export function DepartmentManager() {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null)
  const { toast } = useToast()

  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || isSuperAdmin

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
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
      
      const response = await fetch('/api/admin/departments')
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to load departments")
      }
      
      setDepartments(result.data || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to load departments",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = "Department name is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          description: formData.description.trim() || null,
          is_active: formData.is_active,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to create department")
      }

      toast({
        title: "Success",
        description: "Department created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error("Error creating department:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to create department",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingDepartment || !validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingDepartment.id,
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          description: formData.description.trim() || null,
          is_active: formData.is_active,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update department")
      }

      toast({
        title: "Success",
        description: "Department updated successfully",
      })

      setEditingDepartment(null)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error("Error updating department:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to update department",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!departmentToDelete) return

    try {
      const response = await fetch(`/api/admin/departments?id=${departmentToDelete.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to delete department")
      }

      toast({
        title: "Success",
        description: "Department deleted successfully",
      })

      setShowDeleteDialog(false)
      setDepartmentToDelete(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting department:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to delete department",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      is_active: true,
    })
    setFormErrors({})
  }

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      code: department.code || "",
      description: department.description || "",
      is_active: department.is_active,
    })
    setShowCreateDialog(true)
  }

  const openDeleteDialog = (department: Department) => {
    setDepartmentToDelete(department)
    setShowDeleteDialog(true)
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-muted-foreground py-8">
        You don't have permission to manage departments.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 bg-gray-200/80 dark:bg-gray-800" />
            <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
          </div>
          <Skeleton className="h-10 w-40 bg-gray-200/80 dark:bg-gray-800" />
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Departments</h2>
          <p className="text-muted-foreground">
            Create and manage departments. Roles can be assigned to departments.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setEditingDepartment(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No departments found. Create your first department.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell>
                    {department.code ? (
                      <Badge variant="outline">{department.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {department.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={department.is_active ? "default" : "secondary"}>
                      {department.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(department)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(department)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Edit Department" : "Create Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? "Update department information"
                : "Create a new department. Departments can be assigned to roles."}
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
                placeholder="e.g., Engineering"
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., ENG"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Department description"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
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
              onClick={editingDepartment ? handleUpdate : handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingDepartment ? "Updating..." : "Creating..."}
                </>
              ) : (
                editingDepartment ? "Update" : "Create"
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
              This will permanently delete the department "{departmentToDelete?.name}".
              This action cannot be undone. Make sure no roles are assigned to this department.
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
