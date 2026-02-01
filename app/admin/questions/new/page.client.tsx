"use client"

import { useEffect, useState } from "react"
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
  const [canSubmit, setCanSubmit] = useState(false)

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

  useEffect(() => {
    const onCanSubmit = (event: Event) => {
      const custom = event as CustomEvent<{ canSubmit?: boolean }>
      setCanSubmit(Boolean(custom.detail?.canSubmit))
    }

    window.addEventListener("role-questions:can-submit", onCanSubmit)
    return () => {
      window.removeEventListener("role-questions:can-submit", onCanSubmit)
    }
  }, [])

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Questions</h1>
            <p className="text-muted-foreground mt-2">Design custom questions for your reporting workflow</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(backHref)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              window.dispatchEvent(new Event("role-questions:submit"))
            }}
            disabled={!canSubmit}
          >
            Save Questions
          </Button>
        </div>
      </div>
      <RoleQuestionsCreator />
    </div>
  )
}
