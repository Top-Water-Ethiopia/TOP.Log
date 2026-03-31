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
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  default_can_answer_department_questions: boolean
}

type AccessControlResponse = {
  data: {
    allowedRoles: string[]
  }
}

type DepartmentRolesResponse = {
  data: DepartmentRoleRow[]
}

export function AccessControlTab({ departmentId }: { departmentId: string }) {
  const { toast } = useToast()

  const key = useMemo(() => `/api/admin/departments/${departmentId}/access-control`, [departmentId])
  const { data, error, isLoading, mutate } = useSWR<AccessControlResponse>(key, (url: string) =>
    apiFetch<AccessControlResponse>(url)
  )

  const rolesKey = "/api/admin/department-professions"
  const { data: rolesResponse } = useSWR<DepartmentRolesResponse>(rolesKey, (url: string) =>
    apiFetch<DepartmentRolesResponse>(url)
  )

  const departmentRoles = useMemo(() => {
    const rows: DepartmentRoleRow[] = rolesResponse?.data ?? []
    return rows.filter((r) => r.is_active)
  }, [rolesResponse])

  const allowedRoles = useMemo(() => {
    const rows = data?.data?.allowedRoles || []
    return new Set(rows.filter((r) => typeof r === "string"))
  }, [data])

  const [saving, setSaving] = useState(false)

  const toggleRole = async (roleKey: string, next: boolean) => {
    try {
      setSaving(true)

      const nextAllowed = new Set(Array.from(allowedRoles))
      if (next) nextAllowed.add(roleKey)
      else nextAllowed.delete(roleKey)

      await apiFetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedRoles: Array.from(nextAllowed) }),
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
        <CardDescription>Configure who can answer department-scoped questions in reports.</CardDescription>
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
              {departmentRoles.map((r) => {
                const checked = allowedRoles.has(r.key)
                return (
                  <div key={r.key} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-muted-foreground text-sm">Can answer department questions</div>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(v: boolean) => {
                        void toggleRole(r.key, v)
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
