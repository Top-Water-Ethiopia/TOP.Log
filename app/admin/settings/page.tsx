"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

export default function AdminSettingsPage() {
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
  }, [user, canAccessAdmin, isLoading, router, rbacChecked, rbacLoading])

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin" />
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>View system status and version information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Version</p>
                  <p>1.0.0</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Environment</p>
                  <p>{process.env.NODE_ENV}</p>
                </div>
              </div>
              {false && (
                <Button variant="outline" className="mt-2">
                  Check for Updates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {false && (
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>Create backups or restore from previous backups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Create a backup of your current system configuration and data.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline">Create Backup</Button>
                  <Button variant="outline">Restore from Backup</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Report Types</CardTitle>
            <CardDescription>
              Configure which report types are available for departments and professions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Manage report types (Agent Call, Daily Summary, custom types, etc.) that can be used when creating
                questions.
              </p>
              <Button asChild variant="outline">
                <Link href="/admin/settings/entry-kinds">Manage Report Types</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>View system activity and user actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">View and search through system audit logs.</p>
              <Button variant="outline">View Audit Logs</Button>
            </div>
          </CardContent>
        </Card>

        {canAccessAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Supabase</CardTitle>
              <CardDescription>Run diagnostics and verify Supabase connectivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button asChild variant="outline">
                  <Link href="/supabase-test">Test Connection</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
