"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"

import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"

type DepartmentRoleRow = {
  name: string
  display_name: string
  description: string | null
  level: number
  is_active: boolean
}

type AccessControlResponse = {
  data: {
    accessLevels: DepartmentRoleRow[]
    allowedAccessLevels: string[]
  }
}

export function AccessControlTab({ departmentId }: { departmentId: string }) {
  const { toast } = useToast()

  const key = useMemo(() => `/api/admin/departments/${departmentId}/access-control`, [departmentId])
  const { data, error, isLoading, mutate } = useSWR<AccessControlResponse>(key, (url: string) =>
    apiFetch<AccessControlResponse>(url)
  )

  const accessLevels = useMemo(() => {
    const rows: DepartmentRoleRow[] = data?.data?.accessLevels ?? []
    return rows.filter((row) => row.is_active)
  }, [data])

  const allowedAccessLevels = useMemo(() => {
    const rows = data?.data?.allowedAccessLevels || []
    return new Set(rows.filter((r) => typeof r === "string"))
  }, [data])

  const [saving, setSaving] = useState(false)

  const toggleAccessLevel = async (accessLevelName: string, next: boolean) => {
    try {
      setSaving(true)

      const nextAllowed = new Set(Array.from(allowedAccessLevels))
      if (next) nextAllowed.add(accessLevelName)
      else nextAllowed.delete(accessLevelName)

      await apiFetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedAccessLevels: Array.from(nextAllowed) }),
      })
      await mutate()
      toast({ title: "Saved", description: "Access Control updated" })
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(e, "Failed to update Access Control"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Control</CardTitle>
        <CardDescription>Configure which department access levels can answer department report questions.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
            <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="text-muted-foreground text-sm">{getErrorMessage(error, "Failed to load")}</div>
            <Button variant="outline" onClick={() => mutate()} disabled={saving}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {accessLevels.map((level) => {
                const checked = allowedAccessLevels.has(level.name)
                return (
                  <div key={level.name} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-medium">{level.display_name}</div>
                      <div className="text-muted-foreground text-sm">
                        {level.description || "Can answer department report questions"}
                      </div>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(v: boolean) => {
                        void toggleAccessLevel(level.name, v)
                      }}
                      disabled={saving}
                    />
                  </div>
                )
              })}
            </div>

            <Button variant="outline" onClick={() => mutate()} disabled={saving}>
              Refresh
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
