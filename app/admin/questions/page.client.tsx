"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { Plus } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaginatedTable } from "@/components/ui/paginated-table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type Department = {
  id: string
  name: string
  description: string | null
}

type RoleQuestionRow = {
  id: string
  department_id: string | null
  department_profession_id: string | null
  department_role: string | null
  question_label: string
  question_type: string
  question_description: string | null
  placeholder: string | null
  options: unknown
  is_required: boolean
  display_order: number
  validation_rules: unknown
  is_active: boolean
  created_at: string
  updated_at: string
  metadata: unknown
  question_key?: string | null
  department_profession?: {
    id: string
    key: string
    label: string
  } | null
}

export default function AdminRoleQuestionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const requestedTab = searchParams?.get("tab")
  const defaultTab =
    requestedTab === "department_reports" || requestedTab === "department_lead" ? "department_reports" : "professions"

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const lastLoadErrorRef = useRef<string | null>(null)

  const questionsKey = canAccessAdmin ? "/api/role-questions" : null
  const departmentsKey = canAccessAdmin ? "/api/admin/departments" : null
  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
  } = useSWR<{ data: Department[] }>(departmentsKey, (url: string) => apiFetch<{ data: Department[] }>(url))
  const {
    data: questionsResponse,
    error: questionsError,
    isLoading: isQuestionsLoading,
  } = useSWR<RoleQuestionRow[]>(questionsKey, (url: string) => apiFetch<RoleQuestionRow[]>(url))

  useEffect(() => {
    if (!questionsError && !departmentsError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(questionsError || departmentsError, "Failed to load roles/questions")
    if (lastLoadErrorRef.current !== message) {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      lastLoadErrorRef.current = message
    }
  }, [questionsError, departmentsError, toast])

  const departments = useMemo(() => departmentsResponse?.data || [], [departmentsResponse])
  const questions = useMemo(() => (Array.isArray(questionsResponse) ? questionsResponse : []), [questionsResponse])

  const departmentsById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])

  const roleQuestionCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>()
    for (const q of questions) {
      const professionScopeId = q.department_profession_id || q.department_role
      if (q.department_id && professionScopeId) {
        const key = `${q.department_id}:${professionScopeId}`
        const current = map.get(key) || { total: 0, active: 0 }
        current.total += 1
        if (q.is_active) current.active += 1
        map.set(key, current)
      }
    }
    return map
  }, [questions])

  const departmentQuestionCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>()
    for (const q of questions) {
      if (q.department_id && !q.department_profession_id && !q.department_role) {
        const current = map.get(q.department_id) || { total: 0, active: 0 }
        current.total += 1
        if (q.is_active) current.active += 1
        map.set(q.department_id, current)
      }
    }
    return map
  }, [questions])

  // Table data: professions grouped by department
  const rolesByDepartment = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string
        label: string
        departmentId: string
        roleId: string | null
      }[]
    >()

    // Group profession questions by department_id
    for (const q of questions) {
      const professionScopeId = q.department_profession_id || q.department_role
      if (!q.department_id || !professionScopeId) continue

      const countsKey = `${q.department_id}:${professionScopeId}`
      const current = roleQuestionCounts.get(countsKey) || { total: 0, active: 0 }
      if (current.total === 0) continue

      const department = departmentsById.get(q.department_id)
      const departmentName = department?.name || "Unknown"
      const existing = grouped.get(departmentName) || []

      existing.push({
        key: professionScopeId,
        label:
          q.department_profession?.label ||
          (q.department_role ? q.department_role.charAt(0).toUpperCase() + q.department_role.slice(1).replace(/-/g, " ") : "Unknown Profession"),
        departmentId: q.department_id,
        roleId: q.department_profession_id || null,
      })
      grouped.set(departmentName, existing)
    }

    // Remove duplicates per department and sort
    for (const [departmentName, deptRoles] of grouped) {
      const unique = Array.from(new Map(deptRoles.map((r) => [r.key, r])).values())
      unique.sort((a, b) => a.label.localeCompare(b.label))
      grouped.set(departmentName, unique)
    }

    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [questions, roleQuestionCounts, departmentsById])

  // Table data: departments with lead questions
  const departmentsWithLeadQuestions = useMemo(() => {
    return departments
      .filter((d) => {
        const counts = departmentQuestionCounts.get(d.id) || { total: 0, active: 0 }
        return counts.total > 0
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [departments, departmentQuestionCounts])

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
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                <BreadcrumbPage>Questions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight">Question Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage and refine the survey questions assigned to each crew role.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/questions/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Questions
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profession Questions</CardTitle>
          <CardDescription>Select a profession to manage its questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList>
              <TabsTrigger value="professions">Profession Questions</TabsTrigger>
              <TabsTrigger value="department_reports">Department Report Questions</TabsTrigger>
            </TabsList>

            <TabsContent value="professions" className="mt-4 space-y-2">
              {isQuestionsLoading ? (
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
              ) : rolesByDepartment.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center">No professions found.</div>
              ) : (
                <Accordion
                  type="multiple"
                  defaultValue={rolesByDepartment.map((_, i) => String(i))}
                  className="space-y-2"
                >
                  {rolesByDepartment.map(([departmentName, deptRoles], idx) => (
                    <AccordionItem key={departmentName} value={String(idx)}>
                      <AccordionTrigger className="text-muted-foreground px-4 py-3 text-sm font-semibold tracking-wide uppercase">
                        {departmentName} ({deptRoles.length})
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <PaginatedTable
                          data={deptRoles.map((role) => {
                            const counts = roleQuestionCounts.get(`${role.departmentId}:${role.key}`) || {
                              total: 0,
                              active: 0,
                            }
                            return {
                              roleId: role.roleId,
                              roleKey: role.key,
                              departmentId: role.departmentId,
                              professionName: role.label,
                              departmentName: departmentName,
                              totalQuestions: counts.total,
                              activeQuestions: counts.active,
                            }
                          })}
                          columns={[
                            { key: "professionName", header: "Profession" },
                            { key: "departmentName", header: "Department" },
                            {
                              key: "totalQuestions",
                              header: "Total Questions",
                              cell: (row) => <Badge variant="secondary">{row.totalQuestions}</Badge>,
                            },
                            {
                              key: "activeQuestions",
                              header: "Active",
                              cell: (row) => <Badge variant="outline">{row.activeQuestions}</Badge>,
                            },
                          ]}
                          searchKeys={["professionName", "departmentName"]}
                          searchPlaceholder="Search professions..."
                          rowHref={(row) =>
                            row.roleId
                              ? `/admin/questions/${encodeURIComponent(row.roleId)}`
                              : `/admin/questions/by-department/${encodeURIComponent(row.departmentId)}?role=${encodeURIComponent(row.roleKey)}`
                          }
                          pageSize={10}
                          className="border-0 shadow-none"
                          headerClassName="border-b px-4"
                          tableClassName="px-0"
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="department_reports" className="mt-4 space-y-2">
              {isDepartmentsLoading || isQuestionsLoading ? (
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
              ) : departmentsWithLeadQuestions.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center">No departments with questions found.</div>
              ) : (
                <PaginatedTable
                  data={departmentsWithLeadQuestions.map((dept) => {
                    const counts = departmentQuestionCounts.get(dept.id) || { total: 0, active: 0 }
                    return {
                      departmentId: dept.id,
                      departmentName: dept.name,
                      totalQuestions: counts.total,
                      activeQuestions: counts.active,
                    }
                  })}
                  columns={[
                    { key: "departmentName", header: "Department" },
                    {
                      key: "totalQuestions",
                      header: "Total Questions",
                      cell: (row) => <Badge variant="secondary">{row.totalQuestions}</Badge>,
                    },
                    {
                      key: "activeQuestions",
                      header: "Active",
                      cell: (row) => <Badge variant="outline">{row.activeQuestions}</Badge>,
                    },
                  ]}
                  searchKeys={["departmentName"]}
                  searchPlaceholder="Search departments..."
                  rowHref={(row) => `/admin/questions/by-department/${encodeURIComponent(row.departmentId)}`}
                  pageSize={10}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
