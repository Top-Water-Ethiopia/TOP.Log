"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { MarketingAgentsManager } from "@/components/marketing-agents-manager"
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

export default function AdminMarketingAgentsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
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
  }, [canAccessAdmin, isLoading, rbacChecked, rbacLoading, router, user])

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-5 w-[520px] bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <Skeleton className="h-[520px] w-full bg-gray-200/70 dark:bg-gray-800" />
      </div>
    )
  }

  if (rbacChecked && !canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access marketing agents.</CardDescription>
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
              <BreadcrumbPage>Marketing Agents</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight">Marketing Agents</h1>
        <p className="text-muted-foreground mt-2">
          Manage the external agent contacts assigned to Marketing Sales Promoters for recurring call reports.
        </p>
      </div>

      <MarketingAgentsManager />
    </div>
  )
}
