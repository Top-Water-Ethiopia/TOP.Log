"use client"

import { useEffect, useMemo, useRef } from "react"
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

type Department = {
  id: string
  name: string
}

type RoleRow = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  department?: Department | null
}

export default function AdminRoleQuestionsRolePage() {
  const params = useParams()
  const roleId = useMemo(() => {
    const raw = params?.roleId
    return Array.isArray(raw) ? raw[0] : raw
  }, [params])
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const { toast } = useToast()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const lastLoadErrorRef = useRef<string | null>(null)

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

  const rolesKey = canAccessAdmin ? "/api/admin/roles" : null
  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
  } = useSWR<{ data: RoleRow[] }>(rolesKey, (url: string) => apiFetch<{ data: RoleRow[] }>(url))

  useEffect(() => {
    if (!rolesError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(rolesError, "Failed to load roles")
    if (lastLoadErrorRef.current !== message) {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      lastLoadErrorRef.current = message
    }
  }, [rolesError, toast])

  const role = useMemo(() => {
    const rows = rolesResponse?.data || []
    if (!roleId) return null
    return rows.find((r) => r.id === roleId) || null
  }, [rolesResponse, roleId])

  if (!roleId || isLoading || rbacLoading || !user || !profile) {
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

  const displayName = role?.name ? role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/-/g, " ") : "Role"

  const subtitle = role?.description || role?.department?.name || "Manage questions for this role."

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
                  <Link href="/admin/questions">Questions</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{displayName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/questions">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Roles
            </Button>
          </Link>
          <Link href="/admin/questions/new">
            <Button className="gap-2">Create Multiple Questions</Button>
          </Link>
        </div>
      </div>

      {isRolesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-200/60 dark:bg-gray-800" />
        </div>
      ) : !role ? (
        <Card>
          <CardHeader>
            <CardTitle>Role not found</CardTitle>
            <CardDescription>The requested role does not exist (or you no longer have access).</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/questions">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Roles
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <RoleQuestionsManager fixedRoleId={roleId} fixedRole={role} hideHeader hideStatistics disableRoleCollapse />
      )}
    </div>
  )
}
