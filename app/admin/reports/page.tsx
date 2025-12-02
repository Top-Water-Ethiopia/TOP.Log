"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import { AdminReportsView } from '@/components/admin-reports-view'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
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
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Reports Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  View and manage all individual captain log entries across the organization
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to Admin
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <AdminReportsView />
      </div>
    </div>
  )
}
