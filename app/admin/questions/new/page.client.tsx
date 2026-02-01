"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { RoleQuestionsCreator } from "@/components/role-questions-creator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewRoleQuestionsPageInner() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const scope = searchParams?.get("scope")
  const departmentId = searchParams?.get("departmentId")
  const roleId = searchParams?.get("roleId")

  const isDepartmentScope = scope === "department"
  const isRoleScope = scope === "role" || !scope

  const backHref = isDepartmentScope
    ? departmentId
      ? `/admin/questions/by-department/${encodeURIComponent(departmentId)}`
      : "/admin/questions/by-department"
    : isRoleScope
      ? roleId
        ? `/admin/questions/${encodeURIComponent(roleId)}`
        : "/admin/questions"
      : "/admin/questions"

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
            <Button onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Questions</h1>
          <p className="text-muted-foreground mt-2">
            {isDepartmentScope
              ? "Create multiple custom questions for a department. Eligible users will see these questions when submitting reports."
              : "Create multiple custom questions for a role. Users assigned to this role will see these questions when submitting reports."}
          </p>
        </div>
      </div>
      <RoleQuestionsCreator />
    </div>
  )
}
