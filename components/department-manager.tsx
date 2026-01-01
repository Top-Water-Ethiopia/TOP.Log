"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Loader2, Users, Briefcase } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

interface Department {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export function DepartmentManager() {
  const { profile: currentProfile } = useSupabaseAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null)
  const { toast } = useToast()

  const pageSize = 6

  const clampPage = (requestedPage: number, total: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return Math.min(Math.max(1, requestedPage), totalPages)
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

  const pagination = paginate(departments, page)

  useEffect(() => {
    const nextPage = clampPage(page, departments.length)
    if (nextPage !== page) setPage(nextPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments.length])

  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin =
    currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const [formData, setFormData] = useState({
    name: "",
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

      const response = await fetch("/api/admin/departments")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to load departments")
      }

      setDepartments(result.data || [])
      setPage(1)
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
      const response = await fetch("/api/admin/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
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
      const response = await fetch("/api/admin/departments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingDepartment.id,
          name: formData.name.trim(),
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
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === '23503') { // Foreign key violation
          throw new Error("Cannot delete department. It has roles assigned. Please remove all roles first.")
        }
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
        title: "Cannot Delete Department",
        description: error?.message || "Failed to delete department. Please try again.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
    })
    setFormErrors({})
  }

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
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
      <div className="text-muted-foreground py-8 text-center">You don't have permission to manage departments.</div>
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
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            resetForm()
            setEditingDepartment(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create department
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.total === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                  No departments yet. Create your first department to get started.
                </TableCell>
              </TableRow>
            ) : (
              pagination.pageItems.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell className="max-w-md truncate">{department.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={department.is_active ? "default" : "secondary"}>
                      {department.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/departments/${department.id}/members`}>
                          <Users className="h-4 w-4" />
                          <span className="sr-only">Manage members</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/departments/${department.id}/professions`}>
                          <Briefcase className="h-4 w-4" />
                          <span className="sr-only">Manage profession roles</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(department)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit department</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(department)}>
                        <Trash2 className="text-destructive h-4 w-4" />
                        <span className="sr-only">Delete department</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6">
          <div className="hidden sm:block">
            <p className="text-muted-foreground text-sm">
              Showing <span className="text-foreground font-medium">{pagination.start}</span> to{" "}
              <span className="text-foreground font-medium">{pagination.end}</span> of{" "}
              <span className="text-foreground font-medium">{pagination.total}</span> results
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.total === 0 || pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Prev
            </Button>

            <div className="hidden items-center gap-1 sm:flex">
              {Array.from({ length: pagination.totalPages }).map((_, i) => {
                const p = i + 1
                const active = p === pagination.page
                return (
                  <Button
                    key={`department-page-${p}`}
                    variant="outline"
                    size="sm"
                    disabled={pagination.total === 0}
                    className={active ? "border-primary bg-primary/10 text-primary" : ""}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={pagination.total === 0 || pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit department" : "Create department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? "Update department details."
                : "Create a department so you can assign roles and manage access."}
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
              {formErrors.name && <p className="text-destructive text-sm">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Department description"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={editingDepartment ? handleUpdate : handleCreate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingDepartment ? "Updating..." : "Creating..."}
                </>
              ) : editingDepartment ? (
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
              This will permanently delete the department "{departmentToDelete?.name}". This action cannot be undone.
              Make sure no roles are assigned to this department.
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
