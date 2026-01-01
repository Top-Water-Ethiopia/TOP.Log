"use client"

import { useEffect, useMemo, useState } from "react"
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
import { 
  Shield, 
  FileText,
  Building2,
} from "lucide-react"
import Link from "next/link"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Role IDs from schema
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';

interface MainLayoutUpdatedProps {
	initialRoleQuestions: any[];
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
  const { canAccessAdmin, canCreateEntries } = useRBAC()
  const { user, profile } = useSupabaseAuth()

  const [memberships, setMemberships] = useState<DepartmentMembership[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setMemberships([])
      setActiveDepartmentId(null)
      return
    }

    const loadDepartments = async () => {
      try {
        setIsLoadingDepartments(true)
        const res = await fetch("/api/departments")
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
        const rows = (json.data || []) as DepartmentMembership[]
        setMemberships(rows)
        if (!activeDepartmentId && rows.length > 0) {
          setActiveDepartmentId(rows[0].department_id)
        }
      } catch {
        setMemberships([])
      } finally {
        setIsLoadingDepartments(false)
      }
    }

    loadDepartments()
    // activeDepartmentId intentionally excluded to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const entriesForDepartment = useMemo(() => {
    if (!activeDepartmentId) return []
    return entries.filter((e) => e.department_id === activeDepartmentId)
  }, [entries, activeDepartmentId])

  const { questions: roleQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(
    initialRoleQuestions,
    activeDepartmentId || undefined,
  )
  
  // Check if current user is super admin
  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID;
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">("landing")
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

  const hasRoleQuestions = roleQuestions.length > 0
  const canStartNewReport = !!user && !!activeDepartmentId && canCreateEntries && hasRoleQuestions && !isRoleQuestionsLoading
  const hasSubmittedReports = entriesForDepartment.length > 0
  const newReportDisabledReason = !user
    ? undefined
    : isRoleQuestionsLoading
      ? "Loading role configuration…"
      : !canCreateEntries
        ? "You don’t have permission to create reports."
        : !hasRoleQuestions
          ? "Your role is not configured with role-specific questions yet."
          : undefined

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = activeDepartmentId
      ? entries.find(entry => entry.date === date && entry.department_id === activeDepartmentId)
      : undefined
    // If entry exists, show details (read mode), otherwise show form (edit mode)
    if (existingEntry) {
      setViewMode("details")
    } else {
      setEditingDate(date)
      setViewMode("form")
    }
  }

  const handleSearchSelect = (date: string) => {
    setSelectedDate(date)
    setViewMode("details")
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-background flex-shrink-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setViewMode("landing")}
              className="text-left hover:opacity-80 transition-opacity"
            >
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Navigation - Left side */}
              <SearchDialog onSelectEntry={handleSearchSelect} entries={entriesForDepartment} />

              <Select
                value={activeDepartmentId || ""}
                onValueChange={(value) => {
                  setActiveDepartmentId(value)
                  setSelectedDate(new Date().toISOString().split("T")[0])
                  setEditingDate(undefined)
                  setViewMode("landing")
                }}
                disabled={!user || isLoadingDepartments || memberships.length === 0}
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

              {/* New Report */}
              {user && (
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

              {user && (
                <Link href="/departments">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Departments
                  </Button>
                </Link>
              )}

              {/* Admin - Permission based or Super Admin */}
              {(canAccessAdmin || isSuperAdmin) && (
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
      <main className="flex-1 w-full overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 h-full">
        {viewMode === "landing" ? (
          <LandingPage
            canCreateNewReport={canStartNewReport}
            newReportDisabledReason={newReportDisabledReason}
            hasSubmittedReports={hasSubmittedReports}
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
          <div className="flex gap-6 h-full">
            {/* Left: Calendar - Fixed width, sticky */}
            <div className="w-[380px] flex-shrink-0">
              <div className="sticky top-0 h-full flex flex-col">
                <CalendarView
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  entries={entriesForDepartment}
                />
              </div>
            </div>

            {/* Right: Entry Details */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {activeDepartmentId && (
                <EntryDetails
                  date={selectedDate}
                  departmentId={activeDepartmentId}
                  onEdit={() => {
                    setEditingDate(selectedDate)
                    setViewMode("form")
                  }}
                  onBack={() => setViewMode("calendar")}
                  onViewEntry={(date) => {
                    setSelectedDate(date)
                    setViewMode("details")
                  }}
                />
              )}
            </div>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
              <p className="text-muted-foreground mt-1 text-sm">Select a date to view or create a report</p>
            </div>

            {/* Centered Calendar */}
            <div className="flex-1 flex items-start justify-center overflow-y-auto">
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