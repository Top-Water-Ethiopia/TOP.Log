"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { AdminReportsView } from "@/components/admin-reports-view"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText } from "lucide-react"

export default function AdminReportsPage() {
  const router = useRouter()
  const { user, isLoading } = useSupabaseAuth()
  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system") || hasPermission("analytics.read") || hasPermission("entries.read")

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (!canAccessAdmin) {
      router.push("/")
    }
  }, [user, isLoading, router, rbacChecked, rbacLoading, canAccessAdmin])

  if (isLoading || rbacLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-56 bg-gray-200/80 dark:bg-gray-800" />
              <Skeleton className="h-4 w-40 bg-gray-200/70 dark:bg-gray-800" />
            </div>
            <Skeleton className="h-9 w-32 bg-gray-200/80 dark:bg-gray-800" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card space-y-3 rounded-lg border p-6">
                <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-8 w-20 bg-gray-200/80 dark:bg-gray-800" />
                <Skeleton className="h-3 w-32 bg-gray-200/60 dark:bg-gray-800" />
              </div>
            ))}
          </div>

          <div className="bg-card space-y-4 rounded-lg border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-muted-foreground h-5 w-5" />
                <Skeleton className="h-5 w-44 bg-gray-200/80 dark:bg-gray-800" />
              </div>
              <Skeleton className="h-9 w-28 bg-gray-200/80 dark:bg-gray-800" />
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-64 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-6 w-20 bg-gray-200/70 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center pt-4">
            <Icons.spinner className="text-muted-foreground h-5 w-5 animate-spin" />
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
            <CardDescription>You don't have permission to access admin reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Main Content */}
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">View and manage all reports in the system.</p>
        </div>
        <AdminReportsView />
      </div>
    </div>
  )
}
