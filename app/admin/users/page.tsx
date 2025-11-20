"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { SupabaseUserManagement } from "@/components/supabase-user-management"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function AdminUsersPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || isSuperAdmin

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  if (isLoading || !user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view the users page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => router.push("/")}
              className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all users in the system.
          </p>
        </div>
        <div className="w-full">
          <SupabaseUserManagement />
        </div>
      </div>
    </div>
  )
}
