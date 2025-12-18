"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import { AdminReportsView } from '@/components/admin-reports-view'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, FileText } from 'lucide-react'

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function AdminReportsPage() {
  const router = useRouter()
  const { user, profile, isLoading } = useSupabaseAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
        return
      }

      // Check if user is admin or super admin
      const roleId = profile?.role_id
      const adminAccess = roleId === ADMIN_ROLE_ID || roleId === SUPER_ADMIN_ROLE_ID
      setIsAdmin(adminAccess)

      if (!adminAccess) {
        router.push('/')
      }
    }
  }, [user, profile, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
              <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
                <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-8 w-20 bg-gray-200/80 dark:bg-gray-800" />
                <Skeleton className="h-3 w-32 bg-gray-200/60 dark:bg-gray-800" />
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
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
            <Icons.spinner className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
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
              You don't have permission to access admin reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div>
        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            Back to Admin
          </Button>
        </div>
        <AdminReportsView />
      </div>
    </div>
  )
}
