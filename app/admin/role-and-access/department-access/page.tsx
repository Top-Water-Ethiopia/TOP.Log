"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"

import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import { DepartmentMembersPanel } from "@/app/admin/departments/[departmentId]/members/page"
import { AccessControlTab } from "@/app/admin/departments/[departmentId]/access-control-tab"

type DepartmentRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

type DepartmentRolePermissionsManagerProps = {
  departmentId: string
  departmentRoles: DepartmentRoleRow[]
}

type RolePermissionDraft = {
  id: string
  department_role: string
  resource: string
  action: string
}

function DepartmentRolePermissionsManager({ departmentId, departmentRoles }: DepartmentRolePermissionsManagerProps) {
  const { toast } = useToast()

  const key = useMemo(() => `/api/admin/departments/${departmentId}/role-permissions`, [departmentId])
  const {
    data: permissionsResponse,
    error,
    isLoading,
    mutate,
  } = useSWR<{ data: DepartmentRolePermissionRow[] }>(key, (url: string) =>
    apiFetch<{ data: DepartmentRolePermissionRow[] }>(url)
  )

  const permissions = useMemo(() => {
    const rows = permissionsResponse?.data ?? []
    return [...rows].sort((a, b) => {
      const r = a.resource.localeCompare(b.resource)
      if (r !== 0) return r
      const ac = a.action.localeCompare(b.action)
      if (ac !== 0) return ac
      return a.department_role.localeCompare(b.department_role)
    })
  }, [permissionsResponse])

  const [createRole, setCreateRole] = useState<string>("")
  const [createResource, setCreateResource] = useState<string>("")
  const [createAction, setCreateAction] = useState<string>("")
  const [isCreating, setIsCreating] = useState(false)

  const [draftsById, setDraftsById] = useState<Record<string, RolePermissionDraft>>({})
  const [dirtyById, setDirtyById] = useState<Record<string, boolean>>({})
  const [savingById, setSavingById] = useState<Record<string, boolean>>({})
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setDraftsById((prev) => {
      const next = { ...prev }
      for (const row of permissions) {
        if (!next[row.id] || !dirtyById[row.id]) {
          next[row.id] = {
            id: row.id,
            department_role: row.department_role,
            resource: row.resource,
            action: row.action,
          }
        }
      }
      return next
    })
  }, [permissions, dirtyById])

  const updateDraft = (id: string, updater: (prev: RolePermissionDraft) => RolePermissionDraft) => {
    setDraftsById((prev) => {
      const existing = prev[id]
      if (!existing) return prev
      return { ...prev, [id]: updater(existing) }
    })
    setDirtyById((prev) => ({ ...prev, [id]: true }))
  }

  const refreshRelatedAccessControl = async () => {
    await globalMutate(`/api/admin/departments/${departmentId}/access-control`)
  }

  const handleCreate = async () => {
    const department_role = createRole.trim()
    const resource = createResource.trim().toLowerCase()
    const action = createAction.trim().toLowerCase()

    if (!department_role) {
      toast({ title: "Error", description: "Department role is required", variant: "destructive" })
      return
    }
    if (!resource) {
      toast({ title: "Error", description: "Resource is required", variant: "destructive" })
      return
    }
    if (!action) {
      toast({ title: "Error", description: "Action is required", variant: "destructive" })
      return
    }

    try {
      setIsCreating(true)
      await apiFetch(key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_role, resource, action }),
      })
      setCreateResource("")
      setCreateAction("")
      await mutate()
      await refreshRelatedAccessControl()
      toast({ title: "Created", description: "Permission added" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to add permission"), variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async (id: string) => {
    const draft = draftsById[id]
    if (!draft) return

    try {
      setSavingById((prev) => ({ ...prev, [id]: true }))
      await apiFetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          department_role: draft.department_role.trim(),
          resource: draft.resource.trim().toLowerCase(),
          action: draft.action.trim().toLowerCase(),
        }),
      })
      setDirtyById((prev) => ({ ...prev, [id]: false }))
      await mutate()
      await refreshRelatedAccessControl()
      toast({ title: "Saved", description: "Permission updated" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to update permission"), variant: "destructive" })
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this permission?")
    if (!confirmed) return

    try {
      setDeletingById((prev) => ({ ...prev, [id]: true }))
      await apiFetch(`${key}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      setDirtyById((prev) => ({ ...prev, [id]: false }))
      setDraftsById((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await mutate()
      await refreshRelatedAccessControl()
      toast({ title: "Deleted", description: "Permission removed" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to delete permission"), variant: "destructive" })
    } finally {
      setDeletingById((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role permissions (advanced)</CardTitle>
        <CardDescription>
          CRUD department role permissions for this department (resource + action grants).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Role</div>
            <Select value={createRole} onValueChange={setCreateRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {departmentRoles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Resource</div>
            <Input
              value={createResource}
              onChange={(e) => setCreateResource(e.target.value)}
              placeholder="e.g. department_questions"
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Action</div>
            <Input value={createAction} onChange={(e) => setCreateAction(e.target.value)} placeholder="e.g. answer" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void handleCreate()} disabled={isCreating} className="w-full">
              {isCreating ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="text-muted-foreground text-sm">{getErrorMessage(error, "Failed to load")}</div>
            <Button variant="outline" onClick={() => void mutate()}>
              Retry
            </Button>
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-muted-foreground text-sm">No permissions configured for this department.</div>
        ) : (
          <div className="space-y-3">
            {permissions.map((p) => {
              const draft = draftsById[p.id] ?? {
                id: p.id,
                department_role: p.department_role,
                resource: p.resource,
                action: p.action,
              }
              const dirty = !!dirtyById[p.id]
              const saving = !!savingById[p.id]
              const deleting = !!deletingById[p.id]

              return (
                <div key={p.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4 md:items-end">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Role</div>
                    <Select
                      value={draft.department_role}
                      onValueChange={(v) => updateDraft(p.id, (prev) => ({ ...prev, department_role: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentRoles.map((r) => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Resource</div>
                    <Input
                      value={draft.resource}
                      onChange={(e) => updateDraft(p.id, (prev) => ({ ...prev, resource: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Action</div>
                    <Input
                      value={draft.action}
                      onChange={(e) => updateDraft(p.id, (prev) => ({ ...prev, action: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleSave(p.id)}
                      disabled={!dirty || saving || deleting}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="destructive" onClick={() => void handleDelete(p.id)} disabled={saving || deleting}>
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
  )
}

type DepartmentRoleRow = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
}

type DepartmentRolePermissionRow = {
  id: string
  department_id: string
  department_role: string
  resource: string
  action: string
  created_at: string
  updated_at: string
}

export default function AdminDepartmentAccessIndexPage() {
  return (
    <Suspense fallback={null}>
      <AdminDepartmentAccessIndexPageInner />
    </Suspense>
  )
}

function AdminDepartmentAccessIndexPageInner() {
  const { toast } = useToast()
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const [tab, setTab] = useState<"members" | "roles" | "permissions">("members")

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

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

  const departmentsKey = canAccessAdmin ? "/api/admin/departments" : null
  const { data: departmentsResponse, isLoading: isDepartmentsLoading } = useSWR<{ data: DepartmentRow[] }>(
    departmentsKey,
    (url: string) => apiFetch<{ data: DepartmentRow[] }>(url)
  )

  const deptRolesKey = canAccessAdmin ? "/api/admin/department-roles" : null
  const {
    data: deptRolesResponse,
    error: deptRolesError,
    isLoading: isDeptRolesLoading,
    mutate: mutateDeptRoles,
  } = useSWR<{ data: DepartmentRoleRow[] }>(deptRolesKey, (url: string) => apiFetch<{ data: DepartmentRoleRow[] }>(url))

  const defaultAnswerRoles = useMemo(() => {
    const rows = deptRolesResponse?.data ?? []
    return rows.filter((r) => r.is_active && r.default_can_answer_department_questions)
  }, [deptRolesResponse])

  const activeDepartmentRoles = useMemo(() => {
    const rows = deptRolesResponse?.data ?? []
    return rows.filter((r) => r.is_active)
  }, [deptRolesResponse])

  const departments = useMemo(() => {
    const rows = departmentsResponse?.data || []
    return rows.filter((d) => d.is_active)
  }, [departmentsResponse])

  useEffect(() => {
    const departmentIdFromUrl = searchParams.get("departmentId")
    if (!departmentIdFromUrl) return
    if (selectedDepartmentId) return
    if (!departments.some((d) => d.id === departmentIdFromUrl)) return
    setSelectedDepartmentId(departmentIdFromUrl)
  }, [departments, searchParams, selectedDepartmentId])

  useEffect(() => {
    if (!selectedDepartmentId) return
    if (!departments.some((d) => d.id === selectedDepartmentId)) {
      setSelectedDepartmentId(null)
    }
  }, [departments, selectedDepartmentId])

  const selectedDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null
    return departments.find((d) => d.id === selectedDepartmentId) || null
  }, [departments, selectedDepartmentId])

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-5 w-96 bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border border-gray-200 shadow-sm">
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-32 bg-gray-200/70 dark:bg-gray-800" />
              </CardContent>
            </Card>
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
            <button
              onClick={() => router.push("/")}
              className="bg-primary hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium text-white"
            >
              Go to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
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
                <Link href="/admin/role-and-access">Role and Access</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Department Access</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight">Department Access</h1>
        <p className="text-muted-foreground mt-2">Manage department memberships and access control settings.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium">Department</div>
          <div className="text-muted-foreground text-sm">
            {selectedDepartment ? selectedDepartment.name : "All departments"}
          </div>
        </div>

        <div className="w-full sm:w-[340px]">
          {isDepartmentsLoading ? (
            <Skeleton className="h-10 w-full bg-gray-200/70 dark:bg-gray-800" />
          ) : (
            <Select
              value={selectedDepartmentId ?? "__all__"}
              onValueChange={(v) => setSelectedDepartmentId(v === "__all__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!isDepartmentsLoading && departments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No departments</CardTitle>
            <CardDescription>No active departments found.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "members" | "roles" | "permissions")}>
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <DepartmentMembersPanel departmentId={selectedDepartmentId} />
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <DepartmentRolesManager
              roles={deptRolesResponse?.data ?? []}
              isLoading={isDeptRolesLoading}
              error={deptRolesError}
              mutate={mutateDeptRoles}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            {selectedDepartmentId ? (
              <div className="space-y-4">
                <AccessControlTab departmentId={selectedDepartmentId} />
                <DepartmentRolePermissionsManager
                  departmentId={selectedDepartmentId}
                  departmentRoles={activeDepartmentRoles}
                />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Default department roles & permissions</CardTitle>
                  <CardDescription>These defaults apply across all departments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    {defaultAnswerRoles.length > 0 ? (
                      <>
                        <span className="font-medium">{defaultAnswerRoles.map((r) => r.label).join(", ")}</span>: Can
                        answer department-scoped questions in reports.
                      </>
                    ) : (
                      <>No default roles are currently configured to answer department-scoped questions.</>
                    )}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Select a specific department to view or edit that department’s permissions.
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Use the Roles tab to manage the Department Access Control roles and their default permissions.
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

type DepartmentRolesManagerProps = {
  roles: DepartmentRoleRow[]
  isLoading: boolean
  error: unknown
  mutate: () => Promise<unknown>
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void
}

type DepartmentRoleDraft = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
}

function normalizeDraft(role: DepartmentRoleRow): DepartmentRoleDraft {
  return {
    key: role.key,
    label: role.label,
    sort_order: role.sort_order,
    is_active: role.is_active,
    is_default: role.is_default,
    default_can_answer_department_questions: role.default_can_answer_department_questions,
  }
}

function DepartmentRolesManager({ roles, isLoading, error, mutate, toast }: DepartmentRolesManagerProps) {
  const [draftsByKey, setDraftsByKey] = useState<Record<string, DepartmentRoleDraft>>({})
  const [dirtyByKey, setDirtyByKey] = useState<Record<string, boolean>>({})

  const [createKey, setCreateKey] = useState("")
  const [createLabel, setCreateLabel] = useState("")
  const [createSortOrder, setCreateSortOrder] = useState("0")
  const [createIsActive, setCreateIsActive] = useState(true)
  const [createIsDefault, setCreateIsDefault] = useState(false)
  const [createDefaultCanAnswer, setCreateDefaultCanAnswer] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [savingByKey, setSavingByKey] = useState<Record<string, boolean>>({})
  const [deletingByKey, setDeletingByKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setDraftsByKey((prev) => {
      const next = { ...prev }
      for (const role of roles) {
        const key = role.key
        const isDirty = !!dirtyByKey[key]
        if (!next[key] || !isDirty) {
          next[key] = normalizeDraft(role)
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
      toast({ title: "Error", description: "Key is required", variant: "destructive" })
      return
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast({
        title: "Error",
        description: "Key must be lowercase letters, numbers, and underscores only",
        variant: "destructive",
      })
      return
    }
    if (!label) {
      toast({ title: "Error", description: "Label is required", variant: "destructive" })
      return
    }

    const sort_order = Number(createSortOrder)
    if (!Number.isFinite(sort_order)) {
      toast({ title: "Error", description: "Sort order must be a number", variant: "destructive" })
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
          default_can_answer_department_questions: createDefaultCanAnswer,
        }),
      })
      await mutate()
      setCreateKey("")
      setCreateLabel("")
      setCreateSortOrder("0")
      setCreateIsActive(true)
      setCreateIsDefault(false)
      setCreateDefaultCanAnswer(false)
      toast({ title: "Created", description: "Department role created" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to create role"), variant: "destructive" })
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
          default_can_answer_department_questions: draft.default_can_answer_department_questions,
        }),
      })
      setDirtyByKey((prev) => ({ ...prev, [key]: false }))
      await mutate()
      toast({ title: "Saved", description: "Role updated" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to update role"), variant: "destructive" })
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
      toast({ title: "Deleted", description: "Role deleted" })
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to delete role"), variant: "destructive" })
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
          <CardTitle>Create department role</CardTitle>
          <CardDescription>Add a new Department Access Control role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Input value={createSortOrder} onChange={(e) => setCreateSortOrder(e.target.value)} inputMode="numeric" />
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
          <Button onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

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
                const draft = draftsByKey[r.key] ?? normalizeDraft(r)
                const dirty = !!dirtyByKey[r.key]
                const saving = !!savingByKey[r.key]
                const deleting = !!deletingByKey[r.key]

                return (
                  <div key={r.key} className="space-y-3 rounded-xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold">{r.key}</div>
                        <div className="text-muted-foreground text-sm">{dirty ? "Unsaved changes" : ""}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void handleSave(r.key)} disabled={!dirty || saving}>
                          {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => void handleDelete(r.key)}
                          disabled={deleting || saving}
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
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
                          inputMode="numeric"
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            updateDraft(r.key, (prev) => ({
                              ...prev,
                              sort_order: Number.isFinite(v) ? v : prev.sort_order,
                            }))
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
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
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="text-sm font-medium">Default can answer department questions</div>
                        <Switch
                          checked={draft.default_can_answer_department_questions}
                          onCheckedChange={(v: boolean) =>
                            updateDraft(r.key, (prev) => ({ ...prev, default_can_answer_department_questions: v }))
                          }
                        />
                      </div>
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
