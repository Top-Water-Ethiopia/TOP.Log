"use client"

import { useCallback, useEffect, useState } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { PaginatedTable } from "@/components/ui/paginated-table"

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
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const { toast } = useToast()

  const pageSize = 6

  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)

      const result = await apiFetch<{ data: Department[] }>("/api/admin/departments")
      setDepartments(result.data || [])
    } catch (error: unknown) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to load departments"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin, loadData])

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

    const prevDepartments = departments
    setIsSubmitting(true)
    try {
      const nowIso = new Date().toISOString()
      const tempId = `temp-${Date.now()}`
      const optimistic: Department = {
        id: tempId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
        created_at: nowIso,
        updated_at: nowIso,
      }

      setDepartments((prev) => {
        const next = [...prev, optimistic]
        next.sort((a, b) => a.name.localeCompare(b.name))
        return next
      })

      const created = await apiFetch<{ data: Department }>("/api/admin/departments", {
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

      if (created?.data?.id) {
        setDepartments((prev) => {
          const next = prev.map((d) => (d.id === tempId ? created.data : d))
          next.sort((a, b) => a.name.localeCompare(b.name))
          return next
        })
      }

      toast({
        title: "Success",
        description: "Department created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
    } catch (error: unknown) {
      setDepartments(prevDepartments)
      console.error("Error creating department:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to create department"),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
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
            setShowCreateDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create department
        </Button>
      </div>

      <PaginatedTable
        data={departments}
        isLoading={isLoading}
        emptyMessage="No departments yet. Create your first department to get started."
        pageSize={pageSize}
        searchPlaceholder="Search departments..."
        searchKeys={["name", "description"]}
        rowHref={(dept) => `/admin/departments/${dept.id}?tab=roles`}
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (dept) => <span className="truncate font-medium">{dept.name}</span>,
          },
          {
            key: "description",
            header: "Description",
            cell: (dept) => (
              <span className="text-muted-foreground line-clamp-2 max-w-md">{dept.description || "-"}</span>
            ),
          },
          {
            key: "is_active",
            header: "Status",
            cell: (dept) => (
              <Badge variant={dept.is_active ? "default" : "secondary"}>{dept.is_active ? "Active" : "Inactive"}</Badge>
            ),
          },
        ]}
      />

      <RightSidePanel
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            resetForm()
          }
        }}
        title="Create department"
        description="Create a department so you can assign roles and manage access."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="department-form" disabled={isSubmitting}>
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
          id="department-form"
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
        </form>
      </RightSidePanel>
    </div>
  )
}
