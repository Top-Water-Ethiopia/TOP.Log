"use client"

import { useMemo, useState } from "react"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Shield,
  Users,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
} from "lucide-react"
import type { Role, AccessScope } from "@/lib/rbac/types"

interface RoleSummary {
  total: number
  systemCount: number
  customCount: number
  avgPermissions: number
}

function buildRoleSummary(roles: Role[]): RoleSummary {
  const total = roles.length
  const systemCount = roles.filter((role) => role.isSystem).length
  const customCount = total - systemCount
  const avgPermissions =
    roles.length > 0
      ? roles.reduce((acc, role) => acc + role.permissions.length, 0) / roles.length
      : 0

  return {
    total,
    systemCount,
    customCount,
    avgPermissions,
  }
}

function mapAccessScopes(scopes: AccessScope[]) {
  return scopes.reduce<Record<string, AccessScope>>((acc, scope) => {
    acc[scope.id] = scope
    return acc
  }, {})
}

export function AdminRolesPanel() {
  const { roles, accessScopes } = useRBAC()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const roleSummary = useMemo(() => buildRoleSummary(roles), [roles])
  const accessScopeMap = useMemo(() => mapAccessScopes(accessScopes), [accessScopes])
  const permissionCountMap = useMemo(() => {
    return roles.reduce<Record<string, number>>((acc, role) => {
      role.permissions.forEach((perm) => {
        acc[perm] = (acc[perm] || 0) + 1
      })
      return acc
    }, {})
  }, [roles])
  const allPermissions = useMemo(() => {
    const unique = new Set<string>()
    roles.forEach((role) => {
      role.permissions.forEach((perm) => unique.add(perm))
    })
    return Array.from(unique).sort()
  }, [roles])

  const handleRefresh = () => {
    // Placeholder for future data refresh once persistence APIs are wired
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 600)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold">Role Directory</h3>
          <p className="text-sm text-muted-foreground">
            Review system and custom roles, associated permissions, and access scopes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleSummary.total}</div>
            <p className="text-xs text-muted-foreground">Overall role definitions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleSummary.systemCount}</div>
            <p className="text-xs text-muted-foreground">Protected by the platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleSummary.customCount}</div>
            <p className="text-xs text-muted-foreground">Tailored for your organization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Permissions</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleSummary.avgPermissions.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Per role across the system</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>High-level view of role privileges and attached scopes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[320px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Access Scopes</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{role.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">L{role.level}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 6).map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs font-normal">
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 6} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {role.accessScopes?.length
                          ? role.accessScopes.map((scopeId) => (
                              <Badge key={scopeId} variant="outline" className="text-xs font-normal">
                                {accessScopeMap[scopeId]?.name || scopeId}
                              </Badge>
                            ))
                          : (
                            <span className="text-xs text-muted-foreground">No scopes assigned</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.isSystem ? "destructive" : "default"}>
                        {role.isSystem ? "System" : "Custom"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Permission Utilization</CardTitle>
          <CardDescription>Understanding which permissions are actively assigned.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="grid gap-3 md:grid-cols-2">
              {allPermissions.map((permission) => (
                <div
                  key={permission}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{permission}</span>
                    <span className="text-xs text-muted-foreground">
                      Assigned to {permissionCountMap[permission] || 0} role(s)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {permissionCountMap[permission] || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

