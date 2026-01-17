"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"

type Department = {
  id: string
  name: string
}

type RoleRow = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  department?: Department | null
}

type RoleQuestionRow = {
  id: string
  role_id: string
  is_active: boolean
}

export default function AdminRoleQuestionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const [headerSearchQuery, setHeaderSearchQuery] = useState("")
  const { toast } = useToast()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const lastLoadErrorRef = useRef<string | null>(null)

  const rolesKey = canAccessAdmin ? "/api/admin/roles" : null
  const questionsKey = canAccessAdmin ? "/api/role-questions" : null
  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
  } = useSWR<{ data: RoleRow[] }>(rolesKey, (url: string) => apiFetch<{ data: RoleRow[] }>(url))
  const {
    data: questionsResponse,
    error: questionsError,
    isLoading: isQuestionsLoading,
  } = useSWR<RoleQuestionRow[]>(questionsKey, (url: string) => apiFetch<RoleQuestionRow[]>(url))

  useEffect(() => {
    if (!rolesError && !questionsError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(rolesError || questionsError, "Failed to load roles/questions")
    if (lastLoadErrorRef.current !== message) {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      lastLoadErrorRef.current = message
    }
  }, [rolesError, questionsError, toast])

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])
  const questions = useMemo(() => (Array.isArray(questionsResponse) ? questionsResponse : []), [questionsResponse])

  const roleQuestionCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>()
    for (const q of questions) {
      const current = map.get(q.role_id) || { total: 0, active: 0 }
      current.total += 1
      if (q.is_active) current.active += 1
      map.set(q.role_id, current)
    }
    return map
  }, [questions])

  const filteredRoles = useMemo(() => {
    const query = headerSearchQuery.trim().toLowerCase()
    if (!query) return roles
    return roles.filter((r) => {
      const name = (r.name || "").toLowerCase()
      const desc = (r.description || "").toLowerCase()
      const dept = (r.department?.name || "").toLowerCase()
      return name.includes(query) || desc.includes(query) || dept.includes(query)
    })
  }, [roles, headerSearchQuery])

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
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-4 w-[520px] bg-gray-200/70 dark:bg-gray-800" />
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[420px] bg-gray-200/70 dark:bg-gray-800" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 bg-gray-200/80 dark:bg-gray-800" />
            <Skeleton className="h-10 w-48 bg-gray-200/80 dark:bg-gray-800" />
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-56 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-3 w-80 bg-gray-200/60 dark:bg-gray-800" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-8 w-8 rounded bg-gray-200/70 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Icons.spinner className="text-muted-foreground h-5 w-5 animate-spin" />
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
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-background flex flex-col gap-4 rounded-xl border p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Overview</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Role Questions</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-semibold tracking-tight">Role Question Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage and refine the survey questions assigned to each crew role.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin/role-questions/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Multiple Questions
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icons.search className="h-4 w-4" />
            </div>
            <Input
              placeholder="Search roles..."
              className="pl-9"
              value={headerSearchQuery}
              onChange={(e) => setHeaderSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-muted-foreground text-xs">Filters results below.</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Select a role to manage its questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isRolesLoading || isQuestionsLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-56 bg-gray-200/70 dark:bg-gray-800" />
                    <Skeleton className="h-3 w-80 bg-gray-200/60 dark:bg-gray-800" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20 bg-gray-200/70 dark:bg-gray-800" />
                    <Skeleton className="h-6 w-16 bg-gray-200/70 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center">No roles found. Try adjusting your search.</div>
          ) : (
            filteredRoles.map((role) => {
              const counts = roleQuestionCounts.get(role.id) || { total: 0, active: 0 }
              const displayName = role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/-/g, " ")
              const subtitle = role.description || role.department?.name || "No description"

              return (
                <Link
                  key={role.id}
                  href={`/admin/role-questions/${role.id}`}
                  className="group hover:bg-muted flex items-center justify-between rounded-lg border p-4 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{displayName}</div>
                    <div className="text-muted-foreground truncate text-sm">{subtitle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {counts.total} question{counts.total !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {counts.active} active
                    </Badge>
                    <ChevronRight className="text-muted-foreground h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
