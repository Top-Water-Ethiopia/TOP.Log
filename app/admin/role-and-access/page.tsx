"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { RoleManager } from "@/components/role-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ListSkeleton } from "@/components/skeletons/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function AdminRolesPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()

  const roleAndAccessEnabled = isFeatureEnabledClient("ADMIN_ROLE_AND_ACCESS")

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

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

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <ListSkeleton itemCount={5} />
      </div>
    )
  }

  if (!roleAndAccessEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Role and Access</CardTitle>
            <CardDescription>This feature is not available yet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">Back to Admin</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/permissions">Permissions</Link>
            </Button>
          </CardContent>
        </Card>
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
            <button
              onClick={() => router.push("/")}
              className="bg-primary hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium text-white"
            >
              Go to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin">Overview</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Role and Access</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight">Role and Access</h1>
        <p className="text-muted-foreground mt-2">Manage user roles and permissions across the application</p>
      </div>
      <div className="w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Department Access</CardTitle>
            <CardDescription>Manage department memberships and access control settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/role-and-access/department-access" className="inline-flex">
              <button className="bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium text-white">
                Manage Department Access
              </button>
            </Link>
          </CardContent>
        </Card>
        <div className="w-full">
          <RoleManager />
        </div>
      </div>
    </div>
  )
}
