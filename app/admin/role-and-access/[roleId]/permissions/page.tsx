"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft } from "lucide-react"

import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { RolePermissionsPanel } from "@/components/role-permissions-panel"
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

export default function AdminRolePermissionsPage() {
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
  const { data: rolesResponse, error: rolesError } = useSWR<{ data: RoleRow[] }>(rolesKey, (url: string) =>
    apiFetch<{ data: RoleRow[] }>(url)
  )

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
          <Skeleton className="h-24 w-full" />
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

  return (
    <div className="space-y-6">
      <div>
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
                <Link href="/admin/role-and-access">Role and Access</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Permissions</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {role ? `${role.name} Permissions` : "Role Permissions"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {role ? `Assign permissions for ${role.name}` : "Assign permissions"}
            </p>
          </div>

          <Button variant="outline" onClick={() => router.push("/admin/role-and-access")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Role and Access
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{role ? `Permissions for ${role.name}` : "Permissions"}</CardTitle>
          <CardDescription>Search and assign permissions to this role.</CardDescription>
        </CardHeader>
        <CardContent>{roleId ? <RolePermissionsPanel roleId={roleId} /> : null}</CardContent>
      </Card>
    </div>
  )
}
