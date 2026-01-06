"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { DEFAULT_PERMISSIONS } from "@/lib/rbac/types"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, Save, Search } from "lucide-react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"

interface Role {
  id: string
  name: string
  description: string | null
  department_id: string | null
  created_at: string
  updated_at: string
}

type PermissionRow = {
  id: string
  role_id: string
  resource: string
  action: string
}

function toPermissionName(resource: string, action: string) {
  return `${resource}.${action}`
}

function groupKey(name: string) {
  const [resource] = name.split(".")
  return resource || "other"
}

export function PermissionsManager() {
  const { profile } = useSupabaseAuth()
  const { toast } = useToast()

  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const lastLoadErrorRef = useRef<string | null>(null)

  const isAdmin = !!profile

  const rolesKey = isAdmin ? "/api/admin/roles" : null
  const { data: rolesResponse, error: rolesError, isLoading: isRolesLoading, mutate: mutateRoles } = useSWR<{ data: Role[] }>(
    rolesKey,
  )

  const permissionsKey = selectedRoleId ? `/api/admin/permissions?role_id=${selectedRoleId}` : null
  const {
    data: permissionsResponse,
    error: permissionsError,
    isLoading: isPermissionsLoading,
    mutate: mutatePermissions,
  } = useSWR<{ data: PermissionRow[] }>(permissionsKey)

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])

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
    if (!roles.length) return
    if (selectedRoleId) return
    setSelectedRoleId(roles[0].id)
  }, [roles, selectedRoleId])

  const assignedNames = useMemo(() => {
    const rows = permissionsResponse?.data || []
    return rows.map((p) => toPermissionName(p.resource, p.action))
  }, [permissionsResponse])

  const allKnownNames = useMemo(() => DEFAULT_PERMISSIONS.map((p) => p.name), [])

  const allPermissionNames = useMemo(() => {
    const extra = assignedNames.filter((n) => !allKnownNames.includes(n))
    return Array.from(new Set([...allKnownNames, ...extra])).sort((a, b) => a.localeCompare(b))
  }, [allKnownNames, assignedNames])

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
    <Card>
      <CardHeader>
        <CardTitle>Role permissions</CardTitle>
        <CardDescription>Select a role and choose which permissions it should have.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Role</Label>
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
            {selectedRole ? <div className="text-xs text-muted-foreground">{selectedRole.description || ""}</div> : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Search permissions</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-9" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">{selected.size} selected</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => Promise.all([mutateRoles(), mutatePermissions()])} disabled={isLoading}>
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

        <Tabs defaultValue="grouped">
          <TabsList>
            <TabsTrigger value="grouped">Grouped</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value="grouped" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Grouped by resource</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAll(true)} disabled={filteredPermissionNames.length === 0}>
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
                  <div className="text-xs text-muted-foreground">{permissions.length}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {permissions.map((perm) => {
                    const checked = selected.has(perm)
                    return (
                      <label key={perm} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40">
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
              <div className="text-sm text-muted-foreground">All permissions</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAll(true)} disabled={filteredPermissionNames.length === 0}>
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
                  <label key={perm} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40">
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
  )
}
