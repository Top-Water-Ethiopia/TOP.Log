"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { Loader2, Plus, RefreshCw, Save, Search } from "lucide-react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
  created_at: string
  updated_at: string
}

interface Department {
  id: string
  name: string
  is_active: boolean
}

type PermissionRow = {
  id: string
  role_id: string
  resource: string
  action: string
}

type PermissionCatalogResponse = {
  data: string[]
}

function toPermissionName(resource: string, action: string) {
  return `${resource}.${action}`
}

function groupKey(name: string) {
  const [resource] = name.split(".")
  return resource || "other"
}

function normalizePermissionName(name: string) {
  const trimmed = name.trim()
  const idx = trimmed.indexOf(".")
  if (idx <= 0 || idx === trimmed.length - 1) return null

  const resource = trimmed.slice(0, idx).trim().toLowerCase()
  const action = trimmed
    .slice(idx + 1)
    .trim()
    .toLowerCase()

  if (!resource || !action) return null
  if (/\s/.test(resource) || /\s/.test(action)) return null

  return `${resource}.${action}`
}

export function PermissionsManager() {
  const { profile } = useSupabaseAuth()
  const { toast } = useToast()

  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [newPermission, setNewPermission] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const [showCreateRolePanel, setShowCreateRolePanel] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    department_id: "",
  })
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({})

  const lastLoadErrorRef = useRef<string | null>(null)

  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID

  const rolesKey = isAdmin ? "/api/admin/roles" : null
  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
    mutate: mutateRoles,
  } = useSWR<{ data: Role[] }>(rolesKey)

  const departmentsKey = isAdmin ? "/api/admin/departments" : null
  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
    mutate: mutateDepartments,
  } = useSWR<{ data: Department[] }>(departmentsKey)

  const permissionsKey = selectedRoleId ? `/api/admin/permissions?role_id=${selectedRoleId}` : null
  const {
    data: permissionsResponse,
    error: permissionsError,
    isLoading: isPermissionsLoading,
    mutate: mutatePermissions,
  } = useSWR<{ data: PermissionRow[] }>(permissionsKey)

  const catalogKey = isAdmin ? "/api/admin/permissions/catalog" : null
  const {
    data: catalogResponse,
    error: catalogError,
    mutate: mutateCatalog,
  } = useSWR<PermissionCatalogResponse>(catalogKey)

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])

  const departments = useMemo(() => {
    const rows = departmentsResponse?.data || []
    return rows.filter((d) => d.is_active)
  }, [departmentsResponse])

  useEffect(() => {
    if (!rolesError) return
    const message = getErrorMessage(rolesError, "Failed to load roles")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [rolesError, toast])

  useEffect(() => {
    if (!permissionsError) return
    const message = getErrorMessage(permissionsError, "Failed to load permissions")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [permissionsError, toast])

  useEffect(() => {
    if (!catalogError) return
    const message = getErrorMessage(catalogError, "Failed to load permission catalog")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [catalogError, toast])

  useEffect(() => {
    if (!departmentsError) return
    const message = getErrorMessage(departmentsError, "Failed to load departments")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [departmentsError, toast])

  useEffect(() => {
    if (!roles.length) return
    if (selectedRoleId) return
    setSelectedRoleId(roles[0].id)
  }, [roles, selectedRoleId])

  const assignedNames = useMemo(() => {
    const rows = permissionsResponse?.data || []
    return rows.map((p) => toPermissionName(p.resource, p.action))
  }, [permissionsResponse])

  const selectedNames = useMemo(() => Array.from(selected), [selected])

  const allKnownNames = useMemo(() => {
    const names = catalogResponse?.data
    return Array.isArray(names) ? names : []
  }, [catalogResponse?.data])

  const allPermissionNames = useMemo(() => {
    const extra = [...assignedNames, ...selectedNames].filter((n) => !allKnownNames.includes(n))
    return Array.from(new Set([...allKnownNames, ...extra])).sort((a, b) => a.localeCompare(b))
  }, [allKnownNames, assignedNames, selectedNames])

  useEffect(() => {
    setSelected(new Set(assignedNames))
  }, [assignedNames, selectedRoleId])

  const filteredPermissionNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allPermissionNames
    return allPermissionNames.filter((p) => p.toLowerCase().includes(q))
  }, [allPermissionNames, searchQuery])

  const grouped = useMemo(() => {
    const groups = new Map<string, string[]>()
    filteredPermissionNames.forEach((name) => {
      const key = groupKey(name)
      const current = groups.get(key) || []
      current.push(name)
      groups.set(key, current)
    })

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredPermissionNames])

  const isLoading = isRolesLoading || isPermissionsLoading

  const resetRoleForm = () => {
    setRoleFormData({
      name: "",
      description: "",
      department_id: "",
    })
    setRoleFormErrors({})
  }

  const validateRoleForm = () => {
    const errors: Record<string, string> = {}

    const name = roleFormData.name.trim()
    if (!name) {
      errors.name = "Role name is required"
    } else if (!/^[a-z0-9-]+$/.test(name)) {
      errors.name = "Role name must be lowercase alphanumeric with hyphens only"
    }

    if (!roleFormData.department_id) {
      errors.department_id = "Department is required"
    } else if (!departments.find((d) => d.id === roleFormData.department_id)) {
      errors.department_id = "Invalid department selected"
    }

    setRoleFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const createRole = async () => {
    if (isCreatingRole) return
    if (!validateRoleForm()) return

    const prevRolesResponse = rolesResponse
    setIsCreatingRole(true)

    try {
      const nowIso = new Date().toISOString()
      const tempId = `temp-${Date.now()}`
      const optimistic: Role = {
        id: tempId,
        name: roleFormData.name.trim().toLowerCase(),
        description: roleFormData.description.trim() || null,
        department_id: roleFormData.department_id || null,
        created_at: nowIso,
        updated_at: nowIso,
      }

      mutateRoles(
        (current) => {
          const rows = Array.isArray(current?.data) ? current.data : []
          const next = [...rows, optimistic]
          next.sort((a, b) => a.name.localeCompare(b.name))
          return { data: next }
        },
        { revalidate: false }
      )

      const created = await apiFetch<{ data: Role }>("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roleFormData.name.trim(),
          description: roleFormData.description.trim() || null,
          department_id: roleFormData.department_id || null,
        }),
      })

      if (created?.data?.id) {
        mutateRoles(
          (current) => {
            const rows = Array.isArray(current?.data) ? current.data : []
            const next = rows.map((r) => (r.id === tempId ? created.data : r))
            next.sort((a, b) => a.name.localeCompare(b.name))
            return { data: next }
          },
          { revalidate: false }
        )

        setSelectedRoleId(created.data.id)
      }

      toast({
        title: "Success",
        description: "Role created successfully",
      })

      setShowCreateRolePanel(false)
      resetRoleForm()
    } catch (error) {
      if (prevRolesResponse) {
        mutateRoles(prevRolesResponse, { revalidate: false })
      } else {
        mutateRoles()
      }

      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to create role"),
        variant: "destructive",
      })
    } finally {
      mutateRoles()
      mutateDepartments()
      setIsCreatingRole(false)
    }
  }

  const addPermission = () => {
    const normalized = normalizePermissionName(newPermission)

    if (!newPermission.trim()) return
    if (!normalized) {
      toast({
        title: "Invalid permission",
        description: "Permission must look like 'resource.action' and cannot contain spaces",
        variant: "destructive",
      })
      return
    }

    setSelected((prev) => {
      const next = new Set(prev)
      next.add(normalized)
      return next
    })
    setNewPermission("")
  }

  const toggle = (permission: string, enabled: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(permission)
      else next.delete(permission)
      return next
    })
  }

  const setAll = (enabled: boolean) => {
    if (enabled) {
      setSelected(new Set(filteredPermissionNames))
    } else {
      setSelected(new Set())
    }
  }

  const save = async () => {
    if (!selectedRoleId || isSaving) return

    const permissionList = Array.from(selected).sort((a, b) => a.localeCompare(b))

    setIsSaving(true)
    try {
      await apiFetch(`/api/admin/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role_id: selectedRoleId,
          permissions: permissionList,
        }),
      })

      toast({
        title: "Saved",
        description: "Permissions updated successfully",
      })

      mutatePermissions()
      mutateCatalog()
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save permissions"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Role permissions</CardTitle>
          <CardDescription>Select a role and choose which permissions it should have.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Role</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetRoleForm()
                    setShowCreateRolePanel(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
              {isRolesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedRole ? (
                <div className="text-muted-foreground text-xs">{selectedRole.description || ""}</div>
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Search permissions</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-muted-foreground text-xs">{selected.size} selected</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => Promise.all([mutateRoles(), mutatePermissions(), mutateCatalog()])}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={save} disabled={!selectedRoleId || isSaving}>
                    <Save className={`mr-2 h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Add permission</Label>
            <div className="flex gap-2">
              <Input
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
                placeholder="e.g. reports.export"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addPermission()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addPermission}
                disabled={!selectedRoleId || !newPermission.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <Tabs defaultValue="grouped">
            <TabsList>
              <TabsTrigger value="grouped">Grouped</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value="grouped" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">Grouped by resource</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAll(true)}
                    disabled={filteredPermissionNames.length === 0}
                  >
                    Select all
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAll(false)} disabled={selected.size === 0}>
                    Clear
                  </Button>
                </div>
              </div>

              {grouped.map(([group, permissions]) => (
                <div key={group} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-medium">{group}</div>
                    <div className="text-muted-foreground text-xs">{permissions.length}</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.map((perm) => {
                      const checked = selected.has(perm)
                      return (
                        <label key={perm} className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-2">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggle(perm, v === true)} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{perm}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">All permissions</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAll(true)}
                    disabled={filteredPermissionNames.length === 0}
                  >
                    Select all
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAll(false)} disabled={selected.size === 0}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPermissionNames.map((perm) => {
                  const checked = selected.has(perm)
                  return (
                    <label key={perm} className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-2">
                      <Checkbox checked={checked} onCheckedChange={(v) => toggle(perm, v === true)} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{perm}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RightSidePanel
        open={showCreateRolePanel}
        onOpenChange={(open) => {
          setShowCreateRolePanel(open)
          if (!open) {
            resetRoleForm()
          }
        }}
        title="Create Role"
        description="Create a new custom role. Custom roles must be assigned to a department."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowCreateRolePanel(false)}
              disabled={isCreatingRole}
            >
              Cancel
            </Button>
            <Button type="button" onClick={createRole} disabled={isCreatingRole || isDepartmentsLoading}>
              {isCreatingRole ? (
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
          onSubmit={(e) => {
            e.preventDefault()
            createRole()
          }}
        >
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="role_name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role_name"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., senior-engineer"
                disabled={isCreatingRole}
              />
              {roleFormErrors.name ? <p className="text-destructive text-sm">{roleFormErrors.name}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_department">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={roleFormData.department_id || ""}
                onValueChange={(value) => setRoleFormData((prev) => ({ ...prev, department_id: value }))}
                disabled={isCreatingRole}
              >
                <SelectTrigger id="role_department">
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
                    <SelectItem value="" disabled>
                      No departments available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {roleFormErrors.department_id ? (
                <p className="text-destructive text-sm">{roleFormErrors.department_id}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_description">Description</Label>
              <Textarea
                id="role_description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Role description"
                rows={3}
                disabled={isCreatingRole}
              />
            </div>
          </div>
        </form>
      </RightSidePanel>
    </>
  )
}
