"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { CalendarView } from "./calendar-view"
import { EntryFormMultistep } from "./entry-form-multistep"
import { EntryDetails } from "./entry-details"
import { LandingPage } from "./landing-page"
import { ThankYouPage } from "./thank-you-page"
import { SearchDialog } from "./search-dialog"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { SupabaseNav } from "./supabase-nav"
import { Button } from "./ui/button"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import type { RoleQuestion } from "@/hooks/use-role-questions"
import { toast } from "sonner"
import { Shield, FileText, Building2 } from "lucide-react"
import Link from "next/link"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { canCreateEntryForDate, getToday } from "@/lib/date-restrictions"

interface MainLayoutUpdatedProps {
  initialRoleQuestions: RoleQuestion[]
}

type DepartmentMembership = {
  department_id: string
  role: string
  department: {
    id: string
    name: string
    description: string | null
    is_active: boolean
  }
}

export function MainLayoutUpdated({ initialRoleQuestions }: MainLayoutUpdatedProps) {
  const { entries } = useCaptainLog()
  const { canAccessAdmin, canCreateEntries, hasPermission } = useRBAC()
  const { user } = useSupabaseAuth()

  const [isRequestingAccess, setIsRequestingAccess] = useState(false)

  const [memberships, setMemberships] = useState<DepartmentMembership[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [departmentsLoadStatus, setDepartmentsLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setMemberships([])
      setActiveDepartmentId(null)
      setDepartmentsLoadStatus("idle")
      return
    }

    const loadDepartments = async () => {
      try {
        setIsLoadingDepartments(true)
        setDepartmentsLoadStatus("loading")
        const json = await apiFetch<{ data: DepartmentMembership[] }>("/api/departments")
        const rows = (json.data || []) as DepartmentMembership[]
        setMemberships(rows)
        setDepartmentsLoadStatus("loaded")
        if (rows.length === 0) {
          setActiveDepartmentId(null)
          return
        }

        const departmentIds = rows.map((r) => r.department_id)
        setActiveDepartmentId((prev) => {
          if (rows.length === 1) return rows[0].department_id
          if (prev && departmentIds.includes(prev)) return prev
          return rows[0].department_id
        })
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load departments"))
        setMemberships([])
        setDepartmentsLoadStatus("error")
      } finally {
        setIsLoadingDepartments(false)
      }
    }

    loadDepartments()
    // activeDepartmentId intentionally excluded to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const showNoMembershipsMessage = !!user && departmentsLoadStatus === "loaded" && memberships.length === 0

  const entriesForDepartment = useMemo(() => {
    if (!activeDepartmentId) return []
    return entries.filter((e) => e.department_id === activeDepartmentId)
  }, [entries, activeDepartmentId])

  const { questions: roleQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(
    initialRoleQuestions,
    activeDepartmentId || undefined
  )

  const [selectedDate, setSelectedDate] = useState<string>(getToday())
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">(
    "landing"
  )
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

  const [logDetail, setLogDetail] = useState<(typeof entries)[number] | null>(null)
  const [isLogDetailLoading, setIsLogDetailLoading] = useState(false)

  const loadLogDetail = useCallback(
    async (date: string, departmentId: string) => {
      setLogDetail(null)
      setIsLogDetailLoading(true)
      try {
        await Promise.resolve()
        const entry = entries.find((e) => e.date === date && e.department_id === departmentId) ?? null
        setLogDetail(entry)
      } finally {
        setIsLogDetailLoading(false)
      }
    },
    [entries]
  )

  const hasRoleQuestions = roleQuestions.length > 0
  const canStartNewReport =
    !!user && !!activeDepartmentId && canCreateEntries && hasRoleQuestions && !isRoleQuestionsLoading
  const hasSubmittedReports = entriesForDepartment.length > 0
  const newReportDisabledReason = !user
    ? undefined
    : showNoMembershipsMessage
      ? "You are not assigned to any Department Access Control role. Please contact your administrator."
      : isRoleQuestionsLoading
        ? "Loading role configuration…"
        : !canCreateEntries
          ? "You don’t have permission to create reports."
          : !hasRoleQuestions
            ? "Your role is not configured with role-specific questions yet."
            : undefined

  const requestAccessEnabled = isFeatureEnabledClient("REQUEST_ACCESS")
  const canRequestAccess = requestAccessEnabled && !!user && (!!activeDepartmentId || true) && !canStartNewReport

  const canAccessDepartments =
    !!user ||
    hasPermission("departments.read") ||
    hasPermission("departments.members.read") ||
    hasPermission("departments.members.manage")

  const handleRequestAccess = useCallback(async () => {
    if (!user) return
    if (isRequestingAccess) return

    try {
      setIsRequestingAccess(true)
      await apiFetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department_id: activeDepartmentId,
          requested_role: null,
          message: newReportDisabledReason || null,
        }),
      })
      toast.success("Access request submitted")
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to submit access request"))
    } finally {
      setIsRequestingAccess(false)
    }
  }, [activeDepartmentId, isRequestingAccess, newReportDisabledReason, user])

  const handleDateSelect = (date: string) => {
    setLogDetail(null)
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = activeDepartmentId
      ? entries.find((entry) => entry.date === date && entry.department_id === activeDepartmentId)
      : undefined
    // If entry exists, show details (read mode), otherwise show form (edit mode)
    if (existingEntry) {
      if (activeDepartmentId) {
        void loadLogDetail(date, activeDepartmentId)
      }
      setViewMode("details")
    } else {
      const createValidation = canCreateEntryForDate(date)
      if (!createValidation.isValid) {
        toast.error(createValidation.error || "This date is locked for new reports")
        setEditingDate(undefined)
        return
      }

      setEditingDate(date)
      setViewMode("form")
    }
  }

  const handleSearchSelect = (date: string) => {
    setLogDetail(null)
    setSelectedDate(date)
    if (activeDepartmentId) {
      void loadLogDetail(date, activeDepartmentId)
    }
    setViewMode("details")
  }

  useEffect(() => {
    if (viewMode !== "details") return
    if (!activeDepartmentId) return
    void loadLogDetail(selectedDate, activeDepartmentId)
  }, [activeDepartmentId, loadLogDetail, selectedDate, viewMode])

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setViewMode("landing")}
              className="text-left transition-opacity duration-150 ease-in-out hover:cursor-pointer hover:opacity-80"
            >
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Navigation - Left side */}
              {!showNoMembershipsMessage && isFeatureEnabledClient("SEARCH") ? (
                <SearchDialog onSelectEntry={handleSearchSelect} entries={entriesForDepartment} />
              ) : null}

              {memberships.length > 1 && (
                <Select
                  value={activeDepartmentId || ""}
                  onValueChange={(value) => {
                    setActiveDepartmentId(value)
                    setSelectedDate(getToday())
                    setLogDetail(null)
                    setEditingDate(undefined)
                    setViewMode("landing")
                  }}
                  disabled={!user || isLoadingDepartments}
                >
                  <SelectTrigger className="min-w-[220px]" aria-label="Select department">
                    <SelectValue placeholder={isLoadingDepartments ? "Loading departments..." : "Select department"} />
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.department_id} value={m.department_id}>
                        {m.department?.name || m.department_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* New Report */}
              {user && !showNoMembershipsMessage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!canStartNewReport}
                  title={!canStartNewReport ? newReportDisabledReason : undefined}
                  onClick={() => {
                    if (!canStartNewReport) return
                    setEditingDate(undefined)
                    setViewMode("form")
                  }}
                >
                  <FileText className="h-4 w-4" />
                  New Report
                </Button>
              )}

              {user && !showNoMembershipsMessage && canAccessDepartments && (
                <Link href="/departments">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Departments
                  </Button>
                </Link>
              )}

              {/* Admin */}
              {canAccessAdmin && (
                <>
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                </>
              )}

              {/* Utility Items - Right side */}
              <SupabaseNav />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {showNoMembershipsMessage ? (
            <div className="flex h-full items-center justify-center">
              <div className="bg-card w-full max-w-xl rounded-xl border p-8 shadow-sm">
                <h2 className="text-xl font-semibold">Not assigned</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  You are not assigned to any Department Access Control role. Please contact your administrator.
                </p>
              </div>
            </div>
          ) : viewMode === "landing" ? (
            <LandingPage
              canCreateNewReport={canStartNewReport}
              newReportDisabledReason={newReportDisabledReason}
              hasSubmittedReports={hasSubmittedReports}
              onRequestAccess={canRequestAccess ? handleRequestAccess : undefined}
              isRequestingAccess={isRequestingAccess}
              onNewReport={() => {
                setEditingDate(undefined)
                setViewMode("form")
              }}
              onViewReports={() => setViewMode("calendar")}
            />
          ) : viewMode === "thankYou" ? (
            <ThankYouPage
              onNewReport={() => {
                setEditingDate(undefined)
                setViewMode("form")
              }}
              onViewReports={() => setViewMode("calendar")}
              onBackHome={() => setViewMode("landing")}
            />
          ) : viewMode === "analytics" ? (
            <div className="h-full overflow-y-auto">
              <AnalyticsDashboard />
            </div>
          ) : viewMode === "form" ? (
            <div className="h-full overflow-y-auto">
              {activeDepartmentId && (
                <EntryFormMultistep
                  departmentId={activeDepartmentId}
                  date={editingDate}
                  initialRoleQuestions={initialRoleQuestions}
                  onSave={() => {
                    setEditingDate(undefined)
                    setViewMode("thankYou")
                  }}
                  onCancel={() => {
                    setEditingDate(undefined)
                    setViewMode("landing")
                  }}
                />
              )}
            </div>
          ) : viewMode === "details" ? (
            <Suspense
              fallback={
                <div className="flex h-full gap-6">
                  <div className="w-[380px] shrink-0">
                    <div className="rounded-lg border p-8">
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 overflow-y-auto">
                    <div className="space-y-6">
                      <Skeleton className="h-8 w-44" />
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-[240px] w-full" />
                    </div>
                  </div>
                </div>
              }
            >
              <div className="flex h-full gap-6">
                <div className="w-[380px] shrink-0">
                  <div className="sticky top-0 flex h-full flex-col">
                    <CalendarView
                      selectedDate={selectedDate}
                      onDateSelect={handleDateSelect}
                      entries={entriesForDepartment}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1 overflow-y-auto">
                  {activeDepartmentId && (
                    <EntryDetails
                      date={selectedDate}
                      departmentId={activeDepartmentId}
                      entry={logDetail}
                      isLoading={isLogDetailLoading}
                      onBack={() => setViewMode("calendar")}
                      onViewEntry={(date) => {
                        setLogDetail(null)
                        setSelectedDate(date)
                        if (activeDepartmentId) {
                          void loadLogDetail(date, activeDepartmentId)
                        }
                        setViewMode("details")
                      }}
                    />
                  )}
                </div>
              </div>
            </Suspense>
          ) : viewMode === "calendar" ? (
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
                <p className="text-muted-foreground mt-1 text-sm">Select a date to view or create a report</p>
              </div>

              {/* Centered Calendar */}
              <div className="flex flex-1 items-start justify-center overflow-y-auto">
                <div className="w-full max-w-2xl">
                  <CalendarView
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    entries={entriesForDepartment}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
