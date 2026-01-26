"use client"

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { mutate } from "swr"
import { Loader2, Pencil, Trash2, UserPlus } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type Department = {
  id: string
  name: string
  description?: string | null
  is_active?: boolean
}

export default function AdminDepartmentLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminDepartmentLayoutInner>{children}</AdminDepartmentLayoutInner>
    </Suspense>
  )
}

function AdminDepartmentLayoutInner({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const { toast } = useToast()
  const params = useParams<{ departmentId: string }>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const departmentId = params.departmentId

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const activeTab = useMemo(() => {
    const t = searchParams.get("tab") ?? searchParams.get("tabs")
    if (t === "members" || t === "roles" || t === "access-control") return t
    if (pathname.endsWith(`/admin/departments/${departmentId}/members`)) return "members"
    if (pathname.endsWith(`/admin/departments/${departmentId}/professions`)) return "roles"
    if (pathname.endsWith(`/admin/departments/${departmentId}/access-control`)) return "access-control"
    return "members"
  }, [searchParams, pathname, departmentId])

  const departmentsKey = canAccessAdmin ? "/api/admin/departments" : null

  const { data: departmentsResponse, error: departmentsError } = useSWR<{ data: Department[] }>(departmentsKey)

  const department = useMemo(() => {
    const depts: Department[] = Array.isArray(departmentsResponse?.data) ? (departmentsResponse?.data ?? []) : []
    return depts.find((d) => d.id === departmentId) || null
  }, [departmentsResponse, departmentId])

  const departmentName = department?.name || null
  const departmentDescription = department?.description || null

  const [deletePanelOpen, setDeletePanelOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isDeletingDepartment, setIsDeletingDepartment] = useState(false)
  const deleteInputRef = useRef<HTMLInputElement | null>(null)

  const departmentNameValue = department?.name || ""
  const canConfirmDelete = !!departmentNameValue && deleteConfirmation.trim() === departmentNameValue

  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [headerFocusField, setHeaderFocusField] = useState<"name" | "description">("name")
  const [isSavingHeader, setIsSavingHeader] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!department) return
    if (isEditingHeader) return
    setDraftName(department.name)
    setDraftDescription(department.description || "")
  }, [department, isEditingHeader])

  useEffect(() => {
    if (!isEditingHeader) return
    if (headerFocusField === "name") {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
      return
    }
    descriptionRef.current?.focus()
    descriptionRef.current?.select()
  }, [isEditingHeader, headerFocusField])

  useEffect(() => {
    if (!deletePanelOpen) return
    const handle = setTimeout(() => {
      deleteInputRef.current?.focus()
    }, 50)
    return () => clearTimeout(handle)
  }, [deletePanelOpen])

  const startHeaderEdit = (focusField: "name" | "description") => {
    if (!department || isSavingHeader) return
    setDraftName(department.name)
    setDraftDescription(department.description || "")
    setHeaderFocusField(focusField)
    setIsEditingHeader(true)
  }

  const cancelHeaderEdit = () => {
    if (isSavingHeader) return
    setIsEditingHeader(false)
    setDraftName(department?.name || "")
    setDraftDescription(department?.description || "")
  }

  const saveHeaderEdit = async () => {
    if (!department || isSavingHeader) return

    const name = draftName.trim()
    const description = draftDescription.trim() || null

    if (!name) {
      toast({
        title: "Name required",
        description: "Department name is required",
        variant: "destructive",
      })
      return
    }

    setIsSavingHeader(true)
    try {
      const updated = await apiFetch<{ data: Department & { is_active?: boolean } }>("/api/admin/departments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: department.id,
          name,
          description,
          is_active: department.is_active !== false,
        }),
      })

      await mutate(
        "/api/admin/departments",
        (current: { data: Department[] } | undefined) => {
          const list = Array.isArray(current?.data) ? current!.data : []
          return {
            data: list.map((d) => (d.id === department.id ? { ...d, ...updated.data } : d)),
          }
        },
        false
      )

      toast({
        title: "Saved",
        description: "Department updated successfully",
      })
      setIsEditingHeader(false)
    } catch (error: unknown) {
      console.error("Error updating department:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update department"),
        variant: "destructive",
      })
    } finally {
      setIsSavingHeader(false)
    }
  }

  const openDeletePanel = () => {
    setDeleteConfirmation("")
    setDeletePanelOpen(true)
  }

  const deleteDepartment = async () => {
    if (!departmentId) return
    if (!canConfirmDelete) return
    if (isDeletingDepartment) return

    setIsDeletingDepartment(true)
    try {
      await apiFetch<{ success: boolean }>(`/api/admin/departments?id=${encodeURIComponent(departmentId)}`, {
        method: "DELETE",
      })

      await mutate(
        "/api/admin/departments",
        (current: { data: Department[] } | undefined) => {
          const list = Array.isArray(current?.data) ? current!.data : []
          return { data: list.filter((d) => d.id !== departmentId) }
        },
        false
      )

      toast({
        title: "Deleted",
        description: "Department deleted successfully",
      })

      setDeletePanelOpen(false)
      router.push("/admin/departments")
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete department"),
        variant: "destructive",
      })
    } finally {
      setIsDeletingDepartment(false)
    }
  }

  const lastDepartmentsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!departmentsError) return
    const message = getErrorMessage(departmentsError, "Failed to load department")
    if (message === lastDepartmentsErrorRef.current) return
    lastDepartmentsErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [departmentsError, toast])

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (!canAccessAdmin) {
      router.push("/")
    }
  }, [user, canAccessAdmin, isLoading, router, rbacChecked, rbacLoading])

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="bg-background sticky top-0 z-20 rounded-xl px-6 py-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    )
  }

  if (rbacChecked && !canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20">
        <div className="bg-background rounded-xl px-6 py-6">
          <div className="space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Overview</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/admin/departments">Departments</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{departmentName ? departmentName : "Department"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="space-y-2">
                  {isEditingHeader ? (
                    <div className="space-y-2">
                      <div className="max-w-2xl">
                        <Input
                          ref={nameInputRef}
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelHeaderEdit()
                              return
                            }
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault()
                              saveHeaderEdit()
                            }
                          }}
                        />
                      </div>
                      <div className="max-w-2xl">
                        <Textarea
                          ref={descriptionRef}
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelHeaderEdit()
                              return
                            }
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault()
                              saveHeaderEdit()
                            }
                          }}
                          rows={2}
                          className="resize-none"
                          placeholder="Department description"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" disabled={isSavingHeader} onClick={saveHeaderEdit}>
                          {isSavingHeader ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                        <Button type="button" variant="outline" disabled={isSavingHeader} onClick={cancelHeaderEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <h1 className="text-3xl font-semibold tracking-tight">
                          {departmentName ? departmentName : "Department"}
                        </h1>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startHeaderEdit("name")}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit department name</span>
                        </Button>
                      </div>

                      <div className="flex items-start gap-3">
                        {departmentDescription ? (
                          <div className="text-muted-foreground text-sm">{departmentDescription}</div>
                        ) : (
                          <div className="text-muted-foreground text-sm">No description</div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startHeaderEdit("description")}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit department description</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    router.push(`/admin/departments/${departmentId}?tab=${encodeURIComponent(v)}`)
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="roles">Professional Roles</TabsTrigger>
                    <TabsTrigger value="access-control">Access Control</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div className="flex flex-row items-center gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="dark:bg-background dark:hover:bg-background/90 bg-white hover:bg-white/90"
                    onClick={() => {
                      router.push(`/admin/departments/${departmentId}?tab=members&assign=1`)
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign user
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={openDeletePanel}
                    disabled={!departmentNameValue || isDeletingDepartment}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Department
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {children}

      <RightSidePanel
        open={deletePanelOpen}
        onOpenChange={(open) => {
          if (isDeletingDepartment) return
          setDeletePanelOpen(open)
          if (!open) setDeleteConfirmation("")
        }}
        title="Delete department"
        description={
          departmentNameValue
            ? `This will permanently delete “${departmentNameValue}”. This action cannot be undone.`
            : "This will permanently delete this department. This action cannot be undone."
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletePanelOpen(false)}
              disabled={isDeletingDepartment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteDepartment}
              disabled={!canConfirmDelete || isDeletingDepartment}
            >
              {isDeletingDepartment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-department-confirm">Type the department name to confirm</Label>
            <Input
              id="delete-department-confirm"
              ref={deleteInputRef}
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={departmentNameValue || "Department name"}
              disabled={isDeletingDepartment}
              autoComplete="off"
            />
          </div>
        </div>
      </RightSidePanel>
    </div>
  )
}
