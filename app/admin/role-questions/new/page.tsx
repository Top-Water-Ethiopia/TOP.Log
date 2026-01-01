"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { RoleQuestionsCreator } from "@/components/role-questions-creator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function NewRoleQuestionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

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
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/role-questions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Role Questions</h1>
          <p className="text-muted-foreground mt-2">
            Create multiple custom questions for a role. Users assigned to this role will see these questions when submitting reports.
          </p>
        </div>
      </div>
      <RoleQuestionsCreator />
    </div>
  )
}





