"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft } from "lucide-react"

import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { RoleQuestionsManager } from "@/components/role-questions-manager"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useToast } from "@/components/ui/use-toast"

type DepartmentRow = {
  id: string
  name: string
  description: string | null
}

export default function AdminRoleQuestionsDepartmentPage() {
  const params = useParams()
  const departmentId = useMemo(() => {
    const raw = (params as { departmentId?: string | string[] } | null)?.departmentId
    return Array.isArray(raw) ? raw[0] : raw
  }, [params])

  const searchParams = useSearchParams()
  const departmentRole = useMemo(() => searchParams?.get("role") || null, [searchParams])

  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const { toast } = useToast()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const lastLoadErrorRef = useMemo(() => ({ current: null as string | null }), [])

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
  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
  } = useSWR<{ data: DepartmentRow[] }>(departmentsKey, (url: string) => apiFetch<{ data: DepartmentRow[] }>(url))

  const rolesKey = canAccessAdmin && departmentRole ? "/api/admin/roles" : null
  const { data: rolesResponse } = useSWR<{
    data: Array<{ id: string; name: string; display_name?: string }>
  }>(rolesKey, (url: string) => apiFetch<{ data: Array<{ id: string; name: string; display_name?: string }> }>(url))

  const professionsKey = canAccessAdmin && departmentRole ? "/api/admin/department-professions" : null
  const { data: professionsResponse } = useSWR<{
    data: Array<{ id: string; key: string; label: string }>
  }>(professionsKey, (url: string) => apiFetch<{ data: Array<{ id: string; key: string; label: string }> }>(url))

  useEffect(() => {
    if (!departmentsError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(departmentsError, "Failed to load departments")
    if (lastLoadErrorRef.current !== message) {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      lastLoadErrorRef.current = message
    }
  }, [departmentsError, toast, lastLoadErrorRef])

  const department = useMemo(() => {
    const rows = departmentsResponse?.data || []
    if (!departmentId) return null
    return rows.find((d) => d.id === departmentId) || null
  }, [departmentsResponse, departmentId])

  const roleName = useMemo(() => {
    if (!departmentRole) return null

    // 1. Try Profession Key or ID match (Department Professions Table)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentRole)
    const profession = professionsResponse?.data?.find((p) =>
      isUuid ? p.id === departmentRole : p.key === departmentRole
    )
    if (profession) return profession.label

    // 2. Try Role ID (if UUID) or name match (RBAC Roles Table)
    if (rolesResponse?.data) {
      const role = isUuid
        ? rolesResponse.data.find((r) => r.id === departmentRole)
        : rolesResponse.data.find((r) => r.name.toLowerCase() === departmentRole.toLowerCase())

      if (role) {
        if (isUuid) {
          console.warn(`⚠️ Role resolved by RBAC Role ID instead of profession key for "${departmentRole}"`)
        }
        return role.display_name || role.name.charAt(0).toUpperCase() + role.name.slice(1)
      }
    }

    // 3. Formatted Fallback
    console.warn(`⚠️ Falling back to formatted key for role identifier: "${departmentRole}"`)
    return departmentRole
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }, [professionsResponse, rolesResponse, departmentRole])

  if (!departmentId || isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-4 w-[520px] bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <div className="bg-card rounded-xl border p-6">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-56 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-3 w-80 bg-gray-200/60 dark:bg-gray-800" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
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

  // Build contextual title based on department and role
  const departmentName = department?.name || "Department"

  const title = roleName
    ? `${departmentName} · ${roleName} Profession Questions`
    : `${departmentName} · Department Report Questions`

  const subtitle = roleName
    ? `Manage profession-specific questions for ${roleName} in ${departmentName}.`
    : department?.description || `Manage department report questions for ${departmentName}.`

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
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
                  <Link
                    href={`/admin/questions?tab=${departmentRole ? "professions" : "department_reports"}`}
                  >
                    Questions
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/questions/new?scope=${
              departmentRole && departmentRole !== "undefined" ? "role" : "dept_report"
            }&departmentId=${encodeURIComponent(departmentId)}${
              departmentRole && departmentRole !== "undefined" ? `&role=${encodeURIComponent(departmentRole)}` : ""
            }&tab=${departmentRole && departmentRole !== "undefined" ? "professions" : "department_reports"}`}
          >
            <Button className="gap-2">Create Multiple Questions</Button>
          </Link>
          <Link href={`/admin/questions?tab=${departmentRole ? "professions" : "department_reports"}`}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      {isDepartmentsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-200/60 dark:bg-gray-800" />
        </div>
      ) : !department ? (
        <Card>
          <CardHeader>
            <CardTitle>Department not found</CardTitle>
            <CardDescription>The requested department does not exist (or you no longer have access).</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/questions/by-department">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <RoleQuestionsManager
          departmentId={departmentId}
          departmentRole={departmentRole ?? undefined}
          departmentOnly={!departmentRole}
          hideHeader
          hideStatistics
          hideFilters
        />
      )}
    </div>
  )
}
