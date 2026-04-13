"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { CalendarView } from "./calendar-view"
import { EntryDetails } from "./features/daily-log/organisms"
import { LandingPage } from "./landing-page"
import { ThankYouPage } from "./thank-you-page"
import { SearchDialog } from "./search-dialog"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import type { RoleQuestion } from "@/hooks/use-role-questions"
import { toast } from "sonner"
import { Shield, FileText, Building2, Star, ChevronDown } from "lucide-react"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { ApiError, apiFetch, getErrorMessage } from "@/lib/api-client"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { canCreateEntryForDate, getToday } from "@/lib/date-restrictions"
import { normalizeSalesPromoterProfessionKey } from "@/lib/marketing-agents"
import { useRouter } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { UserMenuDropdown } from "@/components/user-menu-dropdown"

interface MainLayoutUpdatedProps {
  initialRoleQuestions: RoleQuestion[]
}

type DepartmentMembership = {
  department_id: string
  department: {
    id: string
    name: string
    description: string | null
    is_active: boolean
  }
  // Effective role (new contract)
  roleType: "profession" | "access-level" | null
  roleKey: string | null
  roleLabel: string | null
  // Membership status
  is_primary: boolean
  membershipStatus: "active" | "inactive"
  // Explicit capabilities (new contract)
  canViewReports: boolean
  canCreateReports: boolean
  canAnswerDepartmentReports: boolean
  // Legacy fields (backwards compatibility)
  role?: string | null
  department_profession?: {
    key?: string | null
  } | null
}

export function MainLayoutUpdated({ initialRoleQuestions }: MainLayoutUpdatedProps) {
  const { entries } = useCaptainLog()

  const {
    user: rbacUser,
    userInfo,
    permissions,
    rbacLoaded,
    rbacChecked,
    canAccessAdmin,
    canCreateEntries,
    rbacLoading,
  } = useRBAC()
  const { user, isLoading: isAuthLoading } = useSupabaseAuth()
  const router = useRouter()
  const departmentsEnabled = isFeatureEnabledClient("DEPARTMENTS")

  useEffect(() => {
    if (isAuthLoading) return
    if (user) return
    router.replace("/login")
  }, [isAuthLoading, router, user])

  const [isRequestingAccess, setIsRequestingAccess] = useState(false)

  const [memberships, setMemberships] = useState<DepartmentMembership[]>([])
  const [hasSystemWideDeptAccess, setHasSystemWideDeptAccess] = useState(false)
  const [departmentsLoadStatus, setDepartmentsLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.log("=== DEPARTMENTS LOAD SKIPPED ===")
        console.log("Reason: no authenticated user")
        console.log("================================")
      }
      setMemberships([])
      setActiveDepartmentId(null)
      setDepartmentsLoadStatus("loaded")
      return
    }

    const loadDepartments = async () => {
      try {
        setDepartmentsLoadStatus("loading")
        const json = await apiFetch<{ data: DepartmentMembership[]; hasSystemWideAccess: boolean }>("/api/departments")
        const rows = (json.data || []) as DepartmentMembership[]
        setMemberships(rows)
        setHasSystemWideDeptAccess(json.hasSystemWideAccess || false)
        setDepartmentsLoadStatus("loaded")

        if (process.env.NODE_ENV === "development") {
          console.log("=== USER DEPARTMENTS / ACCESS CONTROL ===")
          console.log("Supabase User ID:", user.id)
          console.log("Professional Role (RBAC user.role):", rbacUser?.role)
          console.log("Effective Role (userInfo.role.name):", userInfo?.role?.name)
          console.log("RBAC Loaded:", rbacLoaded, "RBAC Checked:", rbacChecked)
          console.log("RBAC Permissions Count:", Array.isArray(permissions) ? permissions.length : 0)
          console.log(
            "Memberships:",
            rows.map((m) => ({
              department_id: m.department_id,
              department_name: m.department?.name,
              is_department_active: m.department?.is_active,
            }))
          )
          console.log("========================================")
        }

        if (rows.length === 0) {
          setActiveDepartmentId(null)
          return
        }

        // With single active department principle, just set the first (and only) active department
        setActiveDepartmentId(rows[0].department_id)
      } catch (error: unknown) {
        if (process.env.NODE_ENV === "development") {
          console.log("=== DEPARTMENTS LOAD ERROR ===")
          console.log("Error:", error)
          console.log("================================")
        }
        if (!(error instanceof ApiError && error.status === 403)) {
          toast.error(getErrorMessage(error, "Failed to load departments"))
        }
        setMemberships([])
        setDepartmentsLoadStatus("error")
      }
    }

    loadDepartments()
    // activeDepartmentId intentionally excluded to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    if (!user) return
    if (!activeDepartmentId) return

    const membership = memberships.find((m) => m.department_id === activeDepartmentId)
    console.log("=== ACTIVE DEPARTMENT (ACCESS CONTROL) ===")
    console.log("Supabase User ID:", user.id)
    console.log("Active Department ID:", activeDepartmentId)
    console.log("Active Department Name:", membership?.department?.name)
    console.log("Department Access via access_levels:", membership ? "Yes" : "No")
    console.log("========================================")
  }, [activeDepartmentId, memberships, user])

  useEffect(() => {
    if (!user) return
    if (rbacLoading) return
    if (!canAccessAdmin) return
    if (departmentsLoadStatus !== "loaded") return
    if (memberships.length !== 0) return
    router.replace("/admin")
  }, [user, rbacLoading, canAccessAdmin, departmentsLoadStatus, memberships.length, router])

  const showNoMembershipsMessage = !!user && departmentsLoadStatus === "loaded" && memberships.length === 0

  const entriesForDepartment = useMemo(() => {
    if (!activeDepartmentId) return []
    return entries.filter((e) => e.department_id === activeDepartmentId)
  }, [entries, activeDepartmentId])

  const activeDepartmentRole = useMemo(() => {
    if (!activeDepartmentId) return null
    const membership = memberships.find((m) => m.department_id === activeDepartmentId)
    // Use new roleKey field from API (normalized on backend or use as-is)
    const roleKey = membership?.roleKey
    if (typeof roleKey === "string" && roleKey.trim().length > 0) {
      return normalizeSalesPromoterProfessionKey(roleKey)
    }
    // Fallback to legacy fields during transition
    const professionKey = membership?.department_profession?.key
    if (typeof professionKey === "string" && professionKey.trim().length > 0) {
      return normalizeSalesPromoterProfessionKey(professionKey)
    }
    if (typeof membership?.role === "string" && membership.role.trim().length > 0) {
      return normalizeSalesPromoterProfessionKey(membership.role)
    }
    return null
  }, [activeDepartmentId, memberships])

  const { questions: roleQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(
    initialRoleQuestions,
    activeDepartmentId || undefined,
    undefined,
    activeDepartmentRole
  )

  const [selectedDate, setSelectedDate] = useState<string>(getToday())
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "details" | "analytics" | "thankYou">("landing")

  const activeDepartmentMembership = useMemo(() => {
    if (!activeDepartmentId) return null
    return memberships.find((m) => m.department_id === activeDepartmentId) || null
  }, [activeDepartmentId, memberships])

  const hasRoleQuestions = roleQuestions.length > 0
  // Use explicit canCreateReports from API, fallback to legacy logic during transition
  const canStartNewReport =
    !!user &&
    !!activeDepartmentId &&
    (activeDepartmentMembership?.canCreateReports ?? (canCreateEntries && hasRoleQuestions && !isRoleQuestionsLoading))
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
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = activeDepartmentId
      ? entries.find((entry) => entry.date === date && entry.department_id === activeDepartmentId)
      : undefined
    // If entry exists, show details (read mode), otherwise navigate to new log form
    if (existingEntry) {
      setViewMode("details")
    } else {
      const createValidation = canCreateEntryForDate(date)
      if (!createValidation.isValid) {
        toast.error(createValidation.error || "This date is locked for new reports")
        return
      }

      // Navigate to new log route instead of setting viewMode
      router.push(`/logs/new?date=${date}`)
    }
  }

  const handleSearchSelect = (date: string) => {
    setSelectedDate(date)
    setViewMode("details")
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/logs" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Navigation - Left side */}
              {!showNoMembershipsMessage && isFeatureEnabledClient("SEARCH") ? (
                <SearchDialog onSelectEntry={handleSearchSelect} entries={entriesForDepartment} />
              ) : null}

              {/* New Log */}
              {user && !showNoMembershipsMessage && (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!canStartNewReport}
                  title={!canStartNewReport ? newReportDisabledReason : undefined}
                  onClick={() => {
                    if (!canStartNewReport) return
                    router.push("/logs/new")
                  }}
                >
                  <FileText className="h-4 w-4" />
                  New Log
                </Button>
              )}

              {/* Department Selector */}
              {user && !rbacLoading && departmentsEnabled && memberships.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Building2 className="h-4 w-4" />
                      {memberships.find((m) => m.department_id === activeDepartmentId)?.department?.name ||
                        "Department"}
                      {memberships.find((m) => m.department_id === activeDepartmentId)?.is_primary && (
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      )}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {memberships
                      .filter((m) => m.membershipStatus === "active")
                      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                      .map((membership) => (
                        <DropdownMenuItem
                          key={membership.department_id}
                          onClick={() => setActiveDepartmentId(membership.department_id)}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{membership.department.name}</span>
                          {membership.is_primary && (
                            <Star className="ml-2 h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    {memberships.some((m) => m.membershipStatus === "inactive") && (
                      <>
                        <div className="bg-border my-1 h-px" />
                        <div className="text-muted-foreground px-2 py-1 text-xs">Inactive</div>
                        {memberships
                          .filter((m) => m.membershipStatus === "inactive")
                          .map((membership) => (
                            <DropdownMenuItem
                              key={membership.department_id}
                              disabled
                              className="flex items-center justify-between opacity-50"
                            >
                              <span className="truncate">{membership.department.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">Locked</span>
                            </DropdownMenuItem>
                          ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
              {/* <SupabaseNav /> */}

              <UserMenuDropdown
                identifier={(user as any)?.email || (user as any)?.phone || null}
                name={userInfo?.name || null}
                deferUntilMounted
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {isAuthLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                <span>Loading…</span>
              </div>
            </div>
          ) : !user ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                <span>Redirecting to login…</span>
              </div>
            </div>
          ) : showNoMembershipsMessage ? (
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
              isAuthenticated={!!user}
              canCreateNewReport={canStartNewReport}
              newReportDisabledReason={newReportDisabledReason}
              hasSubmittedReports={hasSubmittedReports}
              onRequestAccess={canRequestAccess ? handleRequestAccess : undefined}
              isRequestingAccess={isRequestingAccess}
              onNewReport={() => router.push("/logs/new")}
              onViewReports={() => router.push("/logs")}
            />
          ) : viewMode === "thankYou" ? (
            <ThankYouPage
              onNewReport={() => router.push("/logs/new")}
              onViewReports={() => router.push("/logs")}
              onBackHome={() => setViewMode("landing")}
            />
          ) : viewMode === "analytics" ? (
            <div className="h-full overflow-y-auto">
              <AnalyticsDashboard />
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
              <div className="flex h-full flex-col gap-6">
                <div className="flex flex-1 gap-6 overflow-hidden">
                  <div className="w-[380px] shrink-0">
                    <div className="sticky top-0 flex flex-col">
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
                        onBack={() => setViewMode("calendar")}
                        onViewEntry={(date) => {
                          setSelectedDate(date)
                          setViewMode("details")
                        }}
                      />
                    )}
                  </div>
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
