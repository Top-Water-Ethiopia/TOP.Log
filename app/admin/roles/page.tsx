"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { RoleManager } from "@/components/role-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { ListSkeleton } from "@/components/skeletons/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function AdminRolesPage() {
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
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions across the application
          </p>
        </div>
        <ListSkeleton itemCount={5} />
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
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button 
              onClick={() => router.push("/")} 
              className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
            >
              Go to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-6">
      <RoleManager />
    </div>
  )
}
