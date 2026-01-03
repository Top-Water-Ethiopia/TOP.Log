"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"
import { getErrorMessage } from "@/lib/api-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

type Department = {
  id: string
  name: string
  description?: string | null
}

export default function AdminDepartmentLayout({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const { toast } = useToast()
  const params = useParams<{ departmentId: string }>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const departmentId = params.departmentId

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  const activeTab = useMemo(() => {
    const t = searchParams.get("tab") ?? searchParams.get("tabs")
    if (t === "members" || t === "roles") return t
    if (pathname.endsWith(`/admin/departments/${departmentId}/members`)) return "members"
    if (pathname.endsWith(`/admin/departments/${departmentId}/professions`)) return "roles"
    return "members"
  }, [searchParams, pathname, departmentId])

  const departmentsKey = isAdmin ? "/api/admin/departments" : null

  const { data: departmentsResponse, error: departmentsError } = useSWR<{ data: Department[] }>(departmentsKey)

  const department = useMemo(() => {
    const depts = Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []
    return depts.find((d) => d.id === departmentId) || null
  }, [departmentsResponse, departmentId])

  const departmentName = department?.name || null
  const departmentDescription = department?.description || null

  const lastDepartmentsErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!departmentsError) return
    const message = getErrorMessage(departmentsError, "Failed to load department")
    if (message === lastDepartmentsErrorRef.current) return
    lastDepartmentsErrorRef.current = message
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }, [departmentsError, toast])

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  if (isLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 z-20 rounded-xl border bg-background p-6 shadow-sm">
          <div className="space-y-2">
            <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20">
        <div className="flex flex-col gap-4 rounded-xl border bg-background p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
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
                    <Link href="/admin/departments">Departments</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{departmentName ? departmentName : "Department"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-semibold tracking-tight">{departmentName ? departmentName : "Department"}</h1>
            {departmentDescription ? (
              <div className="text-sm text-muted-foreground">{departmentDescription}</div>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button asChild variant={activeTab === "members" ? "default" : "outline"}>
              <Link href={`/admin/departments/${departmentId}?tab=members`}>People</Link>
            </Button>
            <Button asChild variant={activeTab === "roles" ? "default" : "outline"}>
              <Link href={`/admin/departments/${departmentId}?tab=roles`}>Profession roles</Link>
            </Button>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}
