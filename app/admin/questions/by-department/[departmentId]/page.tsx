"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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

  const title = department?.name || "Department"
  const subtitle = department?.description || "Manage department-scoped questions."

  return (
    <div className="space-y-6">
      <div className="bg-background flex flex-col gap-4 rounded-xl border p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
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
                    <Link href="/admin/questions">Questions</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/admin/questions/by-department">By Department</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/admin/questions/new?scope=department&departmentId=${encodeURIComponent(departmentId)}`}>
              <Button className="gap-2">Create Multiple Questions</Button>
            </Link>
            <Link href="/admin/questions/by-department">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
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
        <RoleQuestionsManager departmentId={departmentId} departmentOnly hideHeader hideStatistics hideFilters />
      )}
    </div>
  )
}
