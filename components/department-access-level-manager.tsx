"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { apiFetch } from "@/lib/api-client"
import { useDepartmentPermissions } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Building2, Shield, X, Key, Power } from "lucide-react"
import { Switch } from "@/components/ui/switch"

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
  is_active: boolean
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
  userId?: string | null
  departmentId: string
  onPendingChange?: (value: string | null) => void
  pendingValue?: string | null
}) {
  const [accessLevels, setAccessLevels] = useState<DepartmentAccessLevel[]>([])
  const [userAssignments, setUserAssignments] = useState<UserDepartmentAccessLevel[]>([])
  const [loadingAccessLevels, setLoadingAccessLevels] = useState(true)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const { user: authUser, session, isLoading: isAuthLoading } = useSupabaseAuth()

  const { permissions: deptPermissionsMap } = useDepartmentPermissions(departmentId)

  // Convert permissions map to array of allowed permission keys
  const deptPermissions = Object.entries(deptPermissionsMap || {})
    .filter(([, effect]) => effect === "allow")
    .map(([permission]) => permission)

  // Fetch access levels
  useEffect(() => {
    if (isAuthLoading) return

    if (!authUser || !session) {
      setLoadingAccessLevels(false)
      return
    }

    const fetchAccessLevels = async () => {
      try {
        const response = await apiFetch<{ data: DepartmentAccessLevel[] }>("/api/admin/department-access-levels")
        if (response.data) {
          setAccessLevels(response.data)
        }
      } catch (error) {
        console.error("Failed to fetch access levels:", error)
      } finally {
        setLoadingAccessLevels(false)
      }
    }

    fetchAccessLevels()
  }, [authUser, isAuthLoading, session])

  // Fetch user's current assignments
  useEffect(() => {
    if (isAuthLoading) return

    if (!authUser || !session) {
      setUserAssignments([])
      setLoadingAssignments(false)
      return
    }

    const fetchUserAssignments = async () => {
      setLoadingAssignments(true)
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
        setLoadingAssignments(false)
      }
    }

    if (userId && departmentId) {
      fetchUserAssignments()
      return
    }

    setUserAssignments([])
    setLoadingAssignments(false)
  }, [authUser, departmentId, isAuthLoading, session, userId])

  const currentAssignment = userAssignments[0]
  const selectedAccessLevelId = currentAssignment?.access_level_id || ""
  const isAssignmentActive = currentAssignment?.is_active ?? true
  const loading = loadingAccessLevels || loadingAssignments

  // Find the currently selected access level details
  const activeSelectionId = pendingValue ?? selectedAccessLevelId
  const selectedAccessLevel = accessLevels.find((l) => l.id === activeSelectionId)

  if (isAuthLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Department Access Level</h3>
            <p className="text-sm text-slate-500">Loading access levels...</p>
          </div>
        </div>
        <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Department Access Level</h3>
            <p className="text-sm text-slate-500">Assign an access level to control permissions in this department</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-200" />
      {/* Enhanced Access Level Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase">
          <Shield className="h-4 w-4 text-slate-500" />
          {currentAssignment ? "Current Access Level" : "Select Access Level"}
        </Label>
        <Select
          value={activeSelectionId}
          onValueChange={(value) => {
            if (value === "__remove__") {
              onPendingChange?.(null)
            } else {
              onPendingChange?.(value)
            }
          }}
        >
          <SelectTrigger className="h-11 w-full shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500">
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
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium">{level.display_name}</span>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      L{level.level}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedAccessLevel?.description && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-sm text-slate-600">{selectedAccessLevel.description}</p>
          </div>
        )}
      </div>

      {/* Status Toggle */}
      {currentAssignment && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase">
            <Power className="h-4 w-4 text-slate-500" />
            Access Status
          </Label>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <Switch
              checked={isAssignmentActive}
              disabled={updatingStatus || !currentAssignment}
              onCheckedChange={async (checked) => {
                if (!userId || !departmentId || !currentAssignment) return
                setUpdatingStatus(true)
                try {
                  await apiFetch(`/api/admin/users/${userId}/department-access-levels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      department_id: departmentId,
                      is_active: checked,
                    }),
                  })
                  // Refresh assignments
                  const response = await apiFetch<{ data: UserDepartmentAccessLevel[] }>(
                    `/api/admin/users/${userId}/department-access-levels`
                  )
                  if (response.data) {
                    setUserAssignments(response.data.filter((a) => a.department_id === departmentId))
                  }
                } catch (error) {
                  console.error("Failed to update access level status:", error)
                } finally {
                  setUpdatingStatus(false)
                }
              }}
            />
            <span className={`text-sm ${isAssignmentActive ? "text-green-700" : "text-slate-500"}`}>
              {isAssignmentActive ? "Active" : "Inactive"}
            </span>
            {updatingStatus && <span className="text-xs text-slate-400">Updating...</span>}
          </div>
          <p className="text-xs text-slate-500">
            {isAssignmentActive
              ? "User can access department resources based on this access level."
              : "User's access is temporarily disabled. They will not be able to access department resources."}
          </p>
        </div>
      )}

      {/* Enhanced Permissions Preview */}
      {deptPermissions.length > 0 && currentAssignment && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase">
              <Key className="h-4 w-4 text-slate-500" />
              Permissions with this Access
            </Label>
            <Badge variant="secondary" className="text-xs">
              {deptPermissions.length} permissions
            </Badge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-wrap gap-2">
              {deptPermissions.slice(0, 8).map((permission: string) => (
                <Badge key={permission} variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  {permission.split(".").pop()}
                </Badge>
              ))}
              {deptPermissions.length > 8 && (
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                  +{deptPermissions.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
