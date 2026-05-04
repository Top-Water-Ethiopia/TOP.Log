"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RefreshCw, Save, Search } from "lucide-react"

type PermissionRow = {
  id: string
  role_id: string
  resource: string
  action: string
}

type PermissionDefinition = {
  id: string
  resource: string
  action: string
  name: string
  description: string | null
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

export function RolePermissionsPanel({ roleId }: { roleId: string }) {
  const { toast } = useToast()
  const lastLoadErrorRef = useRef<string | null>(null)

  const permissionsKey = roleId ? `/api/admin/permissions?role_id=${roleId}` : null
  const {
    data: permissionsResponse,
    error: permissionsError,
    isLoading: isPermissionsLoading,
    mutate: mutatePermissions,
  } = useSWR<{ data: PermissionRow[] }>(permissionsKey)

  const catalogKey = "/api/admin/permissions/catalog"
  const {
    data: catalogResponse,
    error: catalogError,
    mutate: mutateCatalog,
  } = useSWR<PermissionCatalogResponse>(catalogKey)

  const defsKey = "/api/admin/permission-definitions"
  const { data: defsResponse, error: defsError, mutate: mutateDefs } = useSWR<{ data: PermissionDefinition[] }>(defsKey)

  const [searchQuery, setSearchQuery] = useState("")
  const [newPermission, setNewPermission] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  useEffect(() => {
    if (!permissionsError) return
    const message = getErrorMessage(permissionsError, "Failed to load role permissions")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [permissionsError, toast])

  useEffect(() => {
    if (!catalogError) return
    const message = getErrorMessage(catalogError, "Failed to load permission catalog")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [catalogError, toast])

  useEffect(() => {
    if (!defsError) return
    const message = getErrorMessage(defsError, "Failed to load permission definitions")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [defsError, toast])

  const assignedNames = useMemo(() => {
    const rows = permissionsResponse?.data || []
    return rows.map((p) => toPermissionName(p.resource, p.action))
  }, [permissionsResponse])

  const allKnownNames = useMemo(() => {
    const defs = defsResponse?.data
    if (Array.isArray(defs) && defs.length > 0) {
      return defs.map((d) => d.name)
    }

    const names = catalogResponse?.data
    return Array.isArray(names) ? names : []
  }, [catalogResponse?.data, defsResponse?.data])

  const descriptionByName = useMemo(() => {
    const map = new Map<string, string | null>()
    const defs = defsResponse?.data
    if (!Array.isArray(defs)) return map
    defs.forEach((d) => {
      map.set(d.name, d.description)
    })
    return map
  }, [defsResponse?.data])

  const selectedNames = useMemo(() => Array.from(selected), [selected])

  const allPermissionNames = useMemo(() => {
    const extra = [...assignedNames, ...selectedNames].filter((n) => !allKnownNames.includes(n))
    return Array.from(new Set([...allKnownNames, ...extra])).sort((a, b) => a.localeCompare(b))
  }, [allKnownNames, assignedNames, selectedNames])

  const displayAction = useMemo(() => {
    return (permissionName: string) => {
      const idx = permissionName.indexOf(".")
      if (idx < 0 || idx === permissionName.length - 1) return permissionName
      return permissionName.slice(idx + 1)
    }
  }, [])

  useEffect(() => {
    setSelected(new Set(assignedNames))
  }, [assignedNames, roleId])

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

    const entries = Array.from(groups.entries())
    entries.forEach(([group, permissions]) => {
      permissions.sort((a, b) => {
        if (group === "admin") {
          const priority = ["audit", "settings", "system"]
          const aAction = displayAction(a)
          const bAction = displayAction(b)
          const aIdx = priority.indexOf(aAction)
          const bIdx = priority.indexOf(bAction)
          if (aIdx !== -1 || bIdx !== -1) {
            if (aIdx === -1) return 1
            if (bIdx === -1) return -1
            return aIdx - bIdx
          }
        }

        return a.localeCompare(b)
      })
    })

    return entries.sort(([a], [b]) => a.localeCompare(b))
  }, [filteredPermissionNames, displayAction])

  const allGroupKeys = useMemo(() => grouped.map(([group]) => group), [grouped])

  const toggleAllGroups = (expand: boolean) => {
    setExpandedGroups(expand ? allGroupKeys : [])
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

  const save = async () => {
    if (!roleId || isSaving) return

    const permissionList = Array.from(selected).sort((a, b) => a.localeCompare(b))

    setIsSaving(true)
    try {
      await apiFetch(`/api/admin/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role_id: roleId,
          permissions: permissionList,
        }),
      })

      toast({ title: "Saved", description: "Role permissions updated" })

      mutatePermissions()
      mutateCatalog()
      mutateDefs()
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

  const isLoading = isPermissionsLoading

  return (
    <div className="space-y-4">
      <div className="space-y-2">
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
              onClick={() => Promise.all([mutatePermissions(), mutateCatalog(), mutateDefs()])}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              <Save className={`mr-2 h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
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
          <Button type="button" variant="outline" onClick={addPermission} disabled={!newPermission.trim()}>
            Add
          </Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-24 w-full" /> : null}

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
                onClick={() => toggleAllGroups(true)}
                disabled={expandedGroups.length === allGroupKeys.length}
              >
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllGroups(false)}
                disabled={expandedGroups.length === 0}
              >
                Collapse All
              </Button>
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

          <Accordion
            type="multiple"
            value={expandedGroups}
            onValueChange={setExpandedGroups}
            className="rounded-lg border"
          >
            {grouped.map(([group, permissions]) => (
              <AccordionItem key={group} value={group} className="px-4">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-4">
                    <div className="font-medium">{group}</div>
                    <div className="text-muted-foreground text-sm">{permissions.length}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="divide-y rounded-lg border">
                    {permissions.map((perm) => {
                      const checked = selected.has(perm)
                      const description = descriptionByName.get(perm) || null
                      return (
                        <label key={perm} className="hover:bg-muted/40 flex items-start gap-3 p-3">
                          <div className="pt-0.5">
                            <Checkbox checked={checked} onCheckedChange={(v) => toggle(perm, v === true)} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="bg-muted-foreground mt-1 h-1.5 w-1.5 shrink-0 rounded-full" />
                              <div className="truncate text-sm font-medium">{displayAction(perm)}</div>
                            </div>
                            {description ? (
                              <div className="text-muted-foreground truncate text-sm">{description}</div>
                            ) : null}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
              const description = descriptionByName.get(perm) || null
              return (
                <label key={perm} className="hover:bg-muted/40 flex items-start gap-2 rounded-md border p-2">
                  <div className="pt-0.5">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(perm, v === true)} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{perm}</div>
                    {description ? <div className="text-muted-foreground truncate text-sm">{description}</div> : null}
                  </div>
                </label>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
