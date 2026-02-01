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
  department_id?: string | null
  is_active: boolean
}

export default function AdminRoleQuestionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const defaultTab = searchParams?.get("tab") === "department_lead" ? "department_lead" : "professions"

  const systemRoleIds = useMemo(
    () =>
      new Set([
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000010",
      ]),
    []
  )

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const lastLoadErrorRef = useRef<string | null>(null)

  const rolesKey = canAccessAdmin ? "/api/admin/roles" : null
  const questionsKey = canAccessAdmin ? "/api/role-questions" : null
  const departmentsKey = canAccessAdmin ? "/api/admin/departments" : null
  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
  } = useSWR<{ data: RoleRow[] }>(rolesKey, (url: string) => apiFetch<{ data: RoleRow[] }>(url))
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
    if (!rolesError && !questionsError && !departmentsError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(rolesError || questionsError || departmentsError, "Failed to load roles/questions")
    if (lastLoadErrorRef.current !== message) {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      lastLoadErrorRef.current = message
    }
  }, [rolesError, questionsError, departmentsError, toast])

  const roles = useMemo(() => rolesResponse?.data || [], [rolesResponse])
  const departments = useMemo(() => departmentsResponse?.data || [], [departmentsResponse])
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

  const departmentQuestionCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>()
    for (const q of questions) {
      const departmentId = typeof q.department_id === "string" ? q.department_id : null
      if (!departmentId) continue
      const current = map.get(departmentId) || { total: 0, active: 0 }
      current.total += 1
      if (q.is_active) current.active += 1
      map.set(departmentId, current)
    }
    return map
  }, [questions])

  // Table data: professions grouped by department
  const rolesByDepartment = useMemo(() => {
    const grouped = new Map<string, RoleRow[]>()
    for (const role of roles) {
      const counts = roleQuestionCounts.get(role.id) || { total: 0, active: 0 }
      if (counts.total === 0) continue
      if (systemRoleIds.has(role.id)) continue
      const departmentName = role.department?.name || "Unassigned"
      const existing = grouped.get(departmentName) || []
      existing.push(role)
      grouped.set(departmentName, existing)
    }
    for (const [, deptRoles] of grouped) {
      deptRoles.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [roles, roleQuestionCounts, systemRoleIds])

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
                  <BreadcrumbPage>Questions</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-semibold tracking-tight">Question Management</h1>
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
            <CardTitle>Professions Questions</CardTitle>
            <CardDescription>Select a profession to manage its questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList>
                <TabsTrigger value="professions">Professions Questions</TabsTrigger>
                <TabsTrigger value="department_lead">Department Lead Questions</TabsTrigger>
              </TabsList>

              <TabsContent value="professions" className="mt-4 space-y-2">
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
                              const counts = roleQuestionCounts.get(role.id) || { total: 0, active: 0 }
                              const displayName =
                                role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/-/g, " ")
                              return {
                                roleId: role.id,
                                professionName: displayName,
                                departmentName: role.department?.name || "Unassigned",
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
                              {
                                key: "actions",
                                header: "Actions",
                                cell: (row) => (
                                  <Link href={`/admin/questions/${row.roleId}`}>
                                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                                      Manage
                                    </Button>
                                  </Link>
                                ),
                              },
                            ]}
                            searchKeys={["professionName", "departmentName"]}
                            searchPlaceholder="Search professions..."
                            rowHref={(row) => `/admin/questions/${row.roleId}`}
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

              <TabsContent value="department_lead" className="mt-4 space-y-2">
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
                      {
                        key: "actions",
                        header: "Actions",
                        cell: (row) => (
                          <Link href={`/admin/questions/by-department/${row.departmentId}`}>
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              Manage
                            </Button>
                          </Link>
                        ),
                      },
                    ]}
                    searchKeys={["departmentName"]}
                    searchPlaceholder="Search departments..."
                    rowHref={(row) => `/admin/questions/by-department/${row.departmentId}`}
                    pageSize={10}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
