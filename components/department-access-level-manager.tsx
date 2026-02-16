"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import { useDepartmentPermissions } from "@/hooks/use-rbac"
import { Building2, X } from "lucide-react"

interface DepartmentAccessLevel {
  id: string
  name: string
  display_name: string
  description?: string
  level: number
  is_active: boolean
}

interface UserDepartmentAccessLevel {
  id: string
  user_id: string
  department_id: string
  access_level_id: string
  department: {
    id: string
    name: string
    code?: string
  }
  access_level: {
    id: string
    name: string
    display_name: string
    level: number
  }
}

export function DepartmentAccessLevelManager({
  userId,
  departmentId,
  onPendingChange,
  pendingValue,
}: {
  userId: string
  departmentId: string
  onPendingChange?: (value: string | null) => void
  pendingValue?: string | null
}) {
  const [accessLevels, setAccessLevels] = useState<DepartmentAccessLevel[]>([])
  const [userAssignments, setUserAssignments] = useState<UserDepartmentAccessLevel[]>([])
  const [loading, setLoading] = useState(true)

  const { permissions: deptPermissionsMap } = useDepartmentPermissions(departmentId)

  // Convert permissions map to array of allowed permission keys
  const deptPermissions = Object.entries(deptPermissionsMap || {})
    .filter(([, effect]) => effect === "allow")
    .map(([permission]) => permission)

  // Fetch access levels
  useEffect(() => {
    const fetchAccessLevels = async () => {
      try {
        const response = await apiFetch<{ data: DepartmentAccessLevel[] }>("/api/admin/department-access-levels")
        if (response.data) {
          setAccessLevels(response.data)
        }
      } catch (error) {
        console.error("Failed to fetch access levels:", error)
      }
    }

    fetchAccessLevels()
  }, [])

  // Fetch user's current assignments
  useEffect(() => {
    const fetchUserAssignments = async () => {
      try {
        const response = await apiFetch<{ data: UserDepartmentAccessLevel[] }>(
          `/api/admin/users/${userId}/department-access-levels`
        )
        if (response.data) {
          setUserAssignments(response.data.filter((a) => a.department_id === departmentId))
        }
      } catch (error) {
        console.error("Failed to fetch user assignments:", error)
      } finally {
        setLoading(false)
      }
    }

    if (userId && departmentId) {
      fetchUserAssignments()
    }
  }, [userId, departmentId])

  const currentAssignment = userAssignments[0]
  const selectedAccessLevelId = currentAssignment?.access_level_id || ""

  // Find the currently selected access level details
  const selectedAccessLevel = accessLevels.find((l) => l.id === selectedAccessLevelId)

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Department Access Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Department Access Level
        </CardTitle>
        <CardDescription className="text-xs">
          Assign an access level to control permissions in this department
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Access Level Dropdown */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {currentAssignment ? "Current Access Level" : "Select Access Level"}
          </Label>
          <Select
            value={pendingValue ?? selectedAccessLevelId}
            onValueChange={(value) => {
              if (value === "__remove__") {
                onPendingChange?.(null)
              } else {
                onPendingChange?.(value)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an access level..." />
            </SelectTrigger>
            <SelectContent>
              {currentAssignment && (
                <SelectItem value="__remove__" className="text-destructive focus:text-destructive">
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    <span>Remove access level</span>
                  </div>
                </SelectItem>
              )}
              {accessLevels.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No access levels available
                </SelectItem>
              ) : (
                accessLevels.map((level) => (
                  <SelectItem key={level.id} value={level.id} disabled={level.id === selectedAccessLevelId}>
                    <div className="flex items-center gap-2">
                      <span>{level.display_name}</span>
                      <Badge variant="outline" className="text-xs">
                        L{level.level}
                      </Badge>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedAccessLevel?.description && (
            <p className="text-muted-foreground text-xs">{selectedAccessLevel.description}</p>
          )}
        </div>

        {/* Permissions Preview */}
        {deptPermissions.length > 0 && currentAssignment && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Permissions with this access</Label>
            <div className="flex flex-wrap gap-1">
              {deptPermissions.slice(0, 5).map((permission: string) => (
                <Badge key={permission} variant="secondary" className="text-xs">
                  {permission.split(".").pop()}
                </Badge>
              ))}
              {deptPermissions.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{deptPermissions.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
