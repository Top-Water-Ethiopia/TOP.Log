"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginatedTable } from "@/components/ui/paginated-table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CalendarDays,
  FileText,
  BarChart3,
  Users,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { getDateRange, resolveUserName } from "@/lib/admin-reports-utils"
import useSWR from "swr"
import { AdminReportsFilters } from "@/components/admin-reports-filters"
import { AdminReportsDashboardTab } from "@/components/features/admin-reports/admin-reports-dashboard-tab"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import styles from "./admin-reports-view.module.css"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

// Types
interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

interface CaptainLogEntry {
  id: string
  user_id: string
  date: string
  created_at: string
  updated_at: string
  version: number
  metadata: unknown
  custom_responses: CustomResponse[]
  department_id?: string | null
  profession_role_id?: string | null
  profession_role_name?: string | null
  total_questions?: number
}

interface UserProfile {
  user_id: string
  name: string
  email: string
  role_name: string
  department_name: string | null
  department_id?: string | null
  profession_role_id?: string | null
  profession_role_name?: string | null
}

interface EnrichedEntry extends CaptainLogEntry {
  user_profile: UserProfile | null
}

type AdminCaptainLogEntriesResponse = {
  entries: EnrichedEntry[]
  users: UserProfile[]
  roles: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}

interface DashboardStats {
  totalEntries: number
  totalUsers: number
  entriesThisWeek: number
  entriesThisMonth: number
  avgResponsesPerEntry: number
  mostActiveUsers: Array<{ name: string; count: number }>
  entryTrend: "up" | "down" | "stable"
}

/**
 * Admin Reports View - Enterprise-grade reporting interface
 * Following Fortune 500 standards for data visualization and user experience
 */
export function AdminReportsView() {
  const { profile } = useSupabaseAuth()
  const router = useRouter()
  const [selectedView, setSelectedView] = useState<"dashboard" | "entries" | "calendar">("dashboard")

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [sidebarUserSearch, setSidebarUserSearch] = useState("")
  const [calendarUserSearch, setCalendarUserSearch] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("all")
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  })
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])

  const lastLoadErrorRef = useRef<string | null>(null)

  const {
    data,
    error: loadError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<AdminCaptainLogEntriesResponse>("/api/admin/captain-log-entries", {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  })

  const entries = useMemo(() => data?.entries ?? [], [data?.entries])
  const allUsers = useMemo(() => data?.users ?? [], [data?.users])
  const allRoles = useMemo(() => data?.roles ?? [], [data?.roles])
  const allDepartments = useMemo(() => data?.departments ?? [], [data?.departments])

  const isAdmin = useMemo(() => {
    const roleId = profile?.role_id
    return roleId === ADMIN_ROLE_ID || roleId === SYSTEM_ADMIN_ROLE_ID
  }, [profile?.role_id])

  useEffect(() => {
    if (!loadError) {
      lastLoadErrorRef.current = null
      return
    }

    const message = getErrorMessage(loadError, "Failed to load entries")
    if (lastLoadErrorRef.current !== message) {
      toast.error(message)
      lastLoadErrorRef.current = message
    }
  }, [loadError])

  const deleteEntry = async (entryId: string) => {
    const prevData = data
    mutate(
      (current) => {
        if (!current) return current
        return {
          ...current,
          entries: (current.entries || []).filter((e) => e.id !== entryId),
        }
      },
      { revalidate: false }
    )

    try {
      await apiFetch(`/api/admin/captain-log-entries/${entryId}`, { method: "DELETE" })
      toast.success("Report deleted")
      await mutate()
    } catch (error) {
      if (prevData) {
        mutate(prevData, { revalidate: false })
      } else {
        mutate()
      }
      toast.error(getErrorMessage(error, "Failed to delete report"))
    }
  }

  // Calculate dashboard statistics
  const stats: DashboardStats = useMemo(() => {
    const now = new Date()
    const { start: weekStart } = getDateRange("week", now)
    const { start: monthStart } = getDateRange("month", now)
    const twoWeeksAgo = subDays(weekStart, 7) // Prior calendar week start

    const entriesThisWeek = entries.filter((e) => {
      const entryDate = parseISO(e.created_at)
      return entryDate >= weekStart
    }).length

    const entriesLastWeek = entries.filter((e) => {
      const entryDate = parseISO(e.created_at)
      return entryDate >= twoWeeksAgo && entryDate < weekStart
    }).length

    const entriesThisMonth = entries.filter((e) => {
      const entryDate = parseISO(e.created_at)
      return entryDate >= monthStart
    }).length

    const uniqueUsers = new Set(entries.map((e) => e.user_id)).size

    const totalResponses = entries.reduce((sum, e) => sum + (e.custom_responses?.length || 0), 0)
    const avgResponsesPerEntry = entries.length > 0 ? totalResponses / entries.length : 0

    // Most active contributors aggregation with safe fallbacks
    const contributorsMap = new Map<string, { userId: string; name: string; count: number }>()

    entries.forEach((entry) => {
      const userId = entry.user_id
      if (!userId) return

      const existing = contributorsMap.get(userId)
      if (existing) {
        existing.count++
        // Update name if we find a better one in subsequent entries
        if (existing.name.startsWith("User ") || existing.name.startsWith("Deleted User")) {
          const newName = resolveUserName(entry as any)
          if (!newName.startsWith("User ") && !newName.startsWith("Deleted User")) {
            existing.name = newName
          }
        }
      } else {
        contributorsMap.set(userId, {
          userId,
          name: resolveUserName(entry as any),
          count: 1,
        })
      }
    })

    const mostActiveUsers = Array.from(contributorsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Determine trend
    let trend: "up" | "down" | "stable" = "stable"
    if (entriesThisWeek > entriesLastWeek * 1.1) trend = "up"
    else if (entriesThisWeek < entriesLastWeek * 0.9) trend = "down"

    return {
      totalEntries: entries.length,
      totalUsers: uniqueUsers,
      entriesThisWeek,
      entriesThisMonth,
      avgResponsesPerEntry,
      mostActiveUsers,
      entryTrend: trend,
    }
  }, [entries])

  // Update filtered users and roles when department or role changes
  useEffect(() => {
    let filtered = [...allUsers]

    const selectedDepartmentName =
      selectedDepartment === "all" ? null : allDepartments.find((d) => d.id === selectedDepartment)?.name

    // Filter users by department if a department is selected
    if (selectedDepartment !== "all") {
      filtered = filtered.filter((u) => u.department_name === selectedDepartmentName)
    }

    // If a role is selected, filter users by role
    if (selectedRole !== "all") {
      filtered = filtered.filter((user) => user.role_name === selectedRole)
    }

    setFilteredUsers(filtered)

    // Reset user selection if current selection is no longer valid
    if (selectedUser !== "all" && !filtered.some((u) => u.user_id === selectedUser)) {
      setSelectedUser("all")
    }
  }, [allUsers, allRoles, allDepartments, selectedDepartment, selectedRole, selectedUser])

  // Get unique professional roles from actual entries, filtered by department if selected
  const uniqueProfessionalRoles = useMemo(() => {
    const roleSet = new Set<string>()

    // If department is selected, only show roles within that department
    if (selectedDepartment !== "all") {
      const selectedDepartmentName = allDepartments.find((d) => d.id === selectedDepartment)?.name
      entries.forEach((entry) => {
        if (entry.profession_role_name && entry.user_profile?.department_name === selectedDepartmentName) {
          roleSet.add(entry.profession_role_name)
        }
      })
    } else {
      // If no department selected, show all professional roles
      entries.forEach((entry) => {
        if (entry.profession_role_name) {
          roleSet.add(entry.profession_role_name)
        }
      })
    }

    return Array.from(roleSet).sort()
  }, [entries, selectedDepartment, allDepartments])

  // Reset role selection if current role is no longer available after department change
  useEffect(() => {
    if (selectedRole !== "all" && !uniqueProfessionalRoles.includes(selectedRole)) {
      setSelectedRole("all")
    }
  }, [selectedRole, uniqueProfessionalRoles])

  const userOptions = useMemo(() => {
    const base = (filteredUsers.length > 0 ? filteredUsers : allUsers).filter((u) => Boolean(u?.user_id))
    const deduped = new Map<string, UserProfile>()
    for (const u of base) {
      if (!deduped.has(u.user_id)) deduped.set(u.user_id, u)
    }
    return Array.from(deduped.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [allUsers, filteredUsers])

  // Filter entries
  const filteredEntries = useMemo(() => {
    const now = new Date()
    const query = searchQuery.trim().toLowerCase()
    const normalizedSelectedUser = String(selectedUser).trim()
    const selectedDepartmentName =
      selectedDepartment === "all" ? null : allDepartments.find((d) => d.id === selectedDepartment)?.name

    return entries
      .filter((entry) => {
        // 1. User Filter (Hybrid AND: must match if set)
        if (selectedUser !== "all" && String(entry.user_id).trim() !== normalizedSelectedUser) {
          return false
        }

        // 2. Department Filter
        if (selectedDepartment !== "all" && entry.user_profile?.department_name !== selectedDepartmentName) {
          return false
        }

        // 3. Role Filter
        if (selectedRole !== "all" && entry.profession_role_name !== selectedRole) {
          return false
        }

        // 4. Date Range Filter
        if (dateRange !== "all") {
          let start: Date
          let end: Date = endOfDay(now)

          if (dateRange === "custom") {
            if (customDateRange.start && customDateRange.end) {
              start = startOfDay(parseISO(customDateRange.start))
              end = endOfDay(parseISO(customDateRange.end))
            } else {
              return true // Skip date filter if custom range incomplete
            }
          } else {
            const range = getDateRange(dateRange as any, now)
            start = range.start
            end = range.end
          }

          const entryDate = entry.date ? parseISO(entry.date) : parseISO(entry.created_at)
          if (entryDate < start || entryDate > end) {
            return false
          }
        }

        // 5. Search Filter (Partial match, case-insensitive)
        if (query) {
          const searchableText = [
            entry.user_profile?.name,
            entry.user_profile?.email,
            entry.user_profile?.department_name,
            entry.profession_role_name,
          ]
            .filter((val): val is string => typeof val === "string" && val.length > 0)
            .join(" ")
            .toLowerCase()

          if (!searchableText.includes(query)) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [
    entries,
    selectedUser,
    selectedDepartment,
    selectedRole,
    dateRange,
    customDateRange.start,
    customDateRange.end,
    searchQuery,
    allDepartments,
  ])

  // Export functions
  const exportToCSV = () => {
    try {
      // CSV header (removed Responses column)
      let csv = "Submitted By,Department,Professional Role,Submitted At\n"

      // CSV rows using filteredEntries (already filtered by current filters)
      filteredEntries.forEach((entry) => {
        const userName = entry.user_profile?.name || "Unknown"
        const userEmail = entry.user_profile?.email || ""
        const user = userEmail ? `${userName} <${userEmail}>` : userName
        const dept = entry.user_profile?.department_name || "N/A"
        const professionalRole = entry.profession_role_name || "N/A"
        const createdAt = entry.created_at

        csv += `"${user}","${dept}","${professionalRole}","${createdAt}"\n`
      })

      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `captain-log-entries-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${filteredEntries.length} entries to CSV`)
    } catch {
      toast.error("Failed to export CSV")
    }
  }

  const exportToExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredEntries.map((entry) => ({
        "Submitted By": entry.user_profile?.name || "Unknown",
        Email: entry.user_profile?.email || "",
        Department: entry.user_profile?.department_name || "N/A",
        "Professional Role": entry.profession_role_name || "N/A",
        "Submitted At": entry.created_at,
      }))

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Captain Log Entries")

      // Auto-size columns
      const colWidths = [
        { wch: 25 }, // Submitted By
        { wch: 30 }, // Email
        { wch: 20 }, // Department
        { wch: 20 }, // Professional Role
        { wch: 20 }, // Submitted At
      ]
      ws["!cols"] = colWidths

      // Generate and download file
      XLSX.writeFile(wb, `captain-log-entries-${new Date().toISOString().split("T")[0]}.xlsx`)

      toast.success(`Exported ${filteredEntries.length} entries to Excel`)
    } catch {
      toast.error("Failed to export Excel")
    }
  }

  const clearFilters = () => {
    setSelectedUser("all")
    setSelectedDepartment("all")
    setSelectedRole("all")
    setDateRange("all")
    setCustomDateRange({ start: "", end: "" })
    setSearchQuery("")
    setFilteredUsers(allUsers)
  }

  // Check if any filters are active for showing clear button
  const hasCustomDates = customDateRange.start || customDateRange.end
  const hasActiveFilters =
    searchQuery ||
    selectedUser !== "all" ||
    selectedDepartment !== "all" ||
    selectedRole !== "all" ||
    dateRange !== "all" ||
    ((dateRange as string) === "custom" && hasCustomDates)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 bg-gray-200/80 dark:bg-gray-800" />
            <Skeleton className="h-4 w-40 bg-gray-200/70 dark:bg-gray-800" />
          </div>
          <Skeleton className="h-9 w-32 bg-gray-200/80 dark:bg-gray-800" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card space-y-4 rounded-lg border p-6">
              <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
              <Skeleton className="h-8 w-20 bg-gray-200/80 dark:bg-gray-800" />
              <Skeleton className="h-3 w-32 bg-gray-200/60 dark:bg-gray-800" />
            </div>
          ))}
        </div>

        <div className="bg-card space-y-4 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-44 bg-gray-200/80 dark:bg-gray-800" />
            </div>
            <Skeleton className="h-9 w-28 bg-gray-200/80 dark:bg-gray-800" />
          </div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-64 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-6 w-20 bg-gray-200/70 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button onClick={() => mutate()} disabled={isLoading} variant="outline" size="sm" className="gap-2">
            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Data
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs
        value={selectedView}
        onValueChange={(v) => {
          if (v === "dashboard" || v === "entries" || v === "calendar") {
            setSelectedView(v)
          }
        }}
      >
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="entries" className="gap-2">
            <FileText className="h-4 w-4" />
            All Entries
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <AdminReportsDashboardTab
            stats={stats}
            onExportCsv={exportToCSV}
            onViewEntries={() => setSelectedView("entries")}
          />
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-6">
          <AdminReportsFilters
            variant="entries"
            entries={entries}
            allUsers={allUsers}
            allDepartments={allDepartments}
            filteredUsers={filteredUsers}
            uniqueProfessionalRoles={uniqueProfessionalRoles}
            userOptions={userOptions}
            searchQuery={searchQuery}
            selectedUser={selectedUser}
            selectedDepartment={selectedDepartment}
            selectedRole={selectedRole}
            dateRange={dateRange}
            customDateRange={customDateRange}
            calendarUserSearch={calendarUserSearch}
            setSearchQuery={setSearchQuery}
            setSelectedUser={setSelectedUser}
            setSelectedDepartment={setSelectedDepartment}
            setSelectedRole={setSelectedRole}
            setDateRange={setDateRange}
            setCustomDateRange={setCustomDateRange}
            setCalendarUserSearch={setCalendarUserSearch}
            clearFilters={clearFilters}
            exportToCSV={exportToCSV}
            exportToExcel={exportToExcel}
            filteredEntriesCount={filteredEntries.length}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Entries List */}
          {filteredEntries.length === 0 ? (
            <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <CardContent className="py-12 text-center">
                <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="mb-2 text-xl font-semibold">
                  {entries.length === 0 ? "No Entries Yet" : "No entries match your filters"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {entries.length === 0
                    ? "No users have created captain log entries yet."
                    : "Try adjusting your search or filter criteria."}
                </p>

                {entries.length === 0 && (
                  <div className="bg-muted mx-auto mb-6 max-w-2xl rounded-lg p-6 text-left">
                    <h4 className="mb-4 flex items-center gap-2 font-semibold">
                      <Info className="h-5 w-5" />
                      How users create entries:
                    </h4>
                    <ol className="text-muted-foreground space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="min-w-[20px] font-bold">1.</span>
                        <span>Users login to their account</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="min-w-[20px] font-bold">2.</span>
                        <span>Navigate to the main dashboard (Home page)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="min-w-[20px] font-bold">3.</span>
                        <span>Click any date on the calendar</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="min-w-[20px] font-bold">4.</span>
                        <span>Fill out role-specific questions</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="min-w-[20px] font-bold">5.</span>
                        <span>Submit the entry</span>
                      </li>
                    </ol>
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  {entries.length === 0 ? (
                    <Link href="/admin/users">
                      <Button variant="outline" className="gap-2">
                        <Users className="h-4 w-4" />
                        Manage Users
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <PaginatedTable
                data={filteredEntries}
                pageSize={25}
                emptyMessage="No entries found"
                headerClassName="hidden"
                onRowClick={(entry) => {
                  router.push(`/admin/reports/${entry.id}`)
                }}
                columns={[
                  {
                    key: "submitted_by",
                    header: "Submitted By",
                    cell: (entry) => (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {(entry.user_profile?.name || "Unknown")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{entry.user_profile?.name || "Unknown"}</div>
                          <div className="text-muted-foreground truncate text-sm">
                            {entry.user_profile?.email || ""}
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "department",
                    header: "Department",
                    cell: (entry) => {
                      const dept = entry.user_profile?.department_name
                      return dept ? <Badge variant="secondary">{dept}</Badge> : "-"
                    },
                  },
                  {
                    key: "professional_role",
                    header: "Professional Role",
                    cell: (entry) => {
                      const role = entry.profession_role_name || entry.user_profile?.profession_role_name
                      return role ? <Badge variant="secondary">{role}</Badge> : "-"
                    },
                  },
                  {
                    key: "submitted_at",
                    header: "Submitted At",
                    cell: (entry) => {
                      try {
                        return <div className="text-sm">{format(parseISO(entry.created_at), "MMM d, yyyy HH:mm")}</div>
                      } catch {
                        return <div className="text-sm">{entry.created_at}</div>
                      }
                    },
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    className: "text-right",
                    cell: (entry) => (
                      <div className="flex items-center justify-end gap-2" data-row-action>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/reports/${entry.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View report</span>
                        </Button>

                        {isAdmin ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete report</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete report?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    deleteEntry(entry.id)
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </TabsContent>

        {/* Enhanced Calendar View Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card className="border border-gray-200 bg-transparent shadow-lg transition-shadow duration-300 hover:shadow-xl">
            {/* <CardHeader className="pb-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                  onClick={() => mutate()}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
                  <span className="xs:inline hidden">Refresh Data</span>
                  <span className="xs:hidden">Refresh</span>
                </Button>
              </div>
            </CardHeader> */}
            <CardContent className="bg-transparent pt-2">
              <div className={`${styles.filterPanel} ${styles.animateSlideIn}`}>
                <h3 className={styles.filterTitle}>Advanced Filters</h3>
                <AdminReportsFilters
                  variant="calendar"
                  entries={entries}
                  allUsers={allUsers}
                  allDepartments={allDepartments}
                  filteredUsers={filteredUsers}
                  uniqueProfessionalRoles={uniqueProfessionalRoles}
                  userOptions={userOptions}
                  searchQuery={searchQuery}
                  selectedUser={selectedUser}
                  selectedDepartment={selectedDepartment}
                  selectedRole={selectedRole}
                  dateRange={dateRange}
                  customDateRange={customDateRange}
                  calendarUserSearch={calendarUserSearch}
                  setSearchQuery={setSearchQuery}
                  setSelectedUser={setSelectedUser}
                  setSelectedDepartment={setSelectedDepartment}
                  setSelectedRole={setSelectedRole}
                  setDateRange={setDateRange}
                  setCustomDateRange={setCustomDateRange}
                  setCalendarUserSearch={setCalendarUserSearch}
                  clearFilters={clearFilters}
                  exportToCSV={exportToCSV}
                  exportToExcel={exportToExcel}
                  filteredEntriesCount={filteredEntries.length}
                  hasActiveFilters={hasActiveFilters}
                />
              </div>

              {isLoading ? (
                <div className={`${styles.loadingState} ${styles.animateFadeIn}`}>
                  <Loader2 className={`${styles.loadingSpinner} mb-4 h-12 w-12 animate-spin`} />
                  <h3 className={styles.loadingTitle}>Loading reports calendar...</h3>
                  <p className={styles.loadingSubtitle}>Preparing your enterprise data visualization</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className={`${styles.emptyState} ${styles.animateFadeIn}`}>
                  <CalendarDays className={`${styles.emptyIcon} h-12 w-12 sm:h-16 sm:w-16`} />
                  <h3 className={styles.emptyTitle}>
                    {entries.length === 0 ? "No reports found" : "No reports match your filters"}
                  </h3>
                  <p className={styles.emptySubtitle}>
                    {entries.length === 0
                      ? "There are no reports to display. Reports will appear here once submitted by team members."
                      : "Try adjusting your filters to see reports for other users, departments, roles, or time periods."}
                  </p>
                  <div className="flex space-x-4 sm:space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => mutate()}
                      className="h-8 border-gray-300 text-gray-700 sm:h-9"
                    >
                      <RefreshCw className="mr-2 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">Refresh</span>
                    </Button>
                  </div>
                </div>
              ) : (
                (() => {
                  const today = new Date()
                  const monthStart = startOfMonth(calendarMonth)
                  const monthEnd = endOfMonth(calendarMonth)
                  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
                  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

                  const entriesByDate = new Map<string, EnrichedEntry[]>()
                  for (const entry of filteredEntries) {
                    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, [])
                    entriesByDate.get(entry.date)!.push(entry)
                  }

                  const days: Date[] = []
                  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
                    days.push(d)
                  }

                  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
                  const selectedEntries = selectedDateKey ? entriesByDate.get(selectedDateKey) || [] : []
                  const uniqueUsersForSelectedDate = (() => {
                    const map = new Map<string, EnrichedEntry>()
                    for (const entry of selectedEntries) {
                      if (!map.has(entry.user_id)) map.set(entry.user_id, entry)
                    }
                    return Array.from(map.values()).sort((a, b) => {
                      const an = a.user_profile?.name || ""
                      const bn = b.user_profile?.name || ""
                      return an.localeCompare(bn)
                    })
                  })()

                  return (
                    <div className="overflow-hidden rounded-xl border border-gray-300 bg-transparent shadow-lg">
                      <div className="flex items-center justify-between border-b border-gray-200 bg-transparent px-4 py-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, 1)))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-gray-900 sm:text-lg">
                            {format(calendarMonth, "MMMM yyyy")}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                            className="hidden sm:inline-flex"
                          >
                            Today
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, -1)))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-7 border-b border-gray-200 bg-transparent text-xs font-semibold text-gray-700">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                          <div key={label} className="py-2 text-center">
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="grid auto-rows-[92px] grid-cols-7 sm:auto-rows-[110px]">
                        {days.map((day) => {
                          const dayKey = format(day, "yyyy-MM-dd")
                          const dayEntries = entriesByDate.get(dayKey) || []
                          const count = dayEntries.length
                          const isInMonth = isSameMonth(day, monthStart)
                          const isToday = isSameDay(day, today)
                          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false

                          return (
                            <button
                              key={dayKey}
                              type="button"
                              className={
                                `relative border-r border-b border-gray-200 p-2 text-left transition-colors hover:bg-gray-50 focus:outline-hidden ` +
                                (!isInMonth ? "bg-gray-50/60 text-gray-400" : "bg-transparent text-gray-900") +
                                (isToday && !isSelected ? " bg-blue-50/60 ring-1 ring-blue-400/60 ring-inset" : "") +
                                (isSelected ? " bg-blue-50/50 ring-2 ring-blue-500 ring-inset" : "")
                              }
                              onClick={() => {
                                setSelectedDate(day)
                                setIsDetailsOpen(true)
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div
                                  className={
                                    `inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ` +
                                    (isToday && count > 0
                                      ? "bg-blue-600 font-semibold text-white shadow-sm ring-2 ring-white"
                                      : "text-gray-700")
                                  }
                                >
                                  {format(day, "d")}
                                </div>
                                {isToday && !isSelected && (
                                  <div className="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] leading-none font-semibold text-blue-700">
                                    Today
                                  </div>
                                )}
                                {count > 0 && (
                                  <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
                                    {count}
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <Sheet
                        open={isDetailsOpen}
                        onOpenChange={(open) => {
                          setIsDetailsOpen(open)
                          if (!open) {
                            setSelectedDate(null)
                            setSidebarUserSearch("")
                          }
                        }}
                      >
                        <SheetContent className="sm:max-w-md">
                          <SheetHeader>
                            <SheetTitle>
                              {selectedDate ? `Reports for ${format(selectedDate, "MMMM d, yyyy")}` : "Reports"}
                            </SheetTitle>
                          </SheetHeader>

                          <div className="px-4 pb-4">
                            {selectedDate && uniqueUsersForSelectedDate.length === 0 ? (
                              <div className="bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
                                No reports for this date.
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Input
                                  value={sidebarUserSearch}
                                  onChange={(e) => setSidebarUserSearch(e.target.value)}
                                  placeholder="Search users..."
                                />

                                {(() => {
                                  const q = sidebarUserSearch.trim().toLowerCase()
                                  const filtered = uniqueUsersForSelectedDate.filter((entry) => {
                                    if (!q) return true
                                    const name = (entry.user_profile?.name || "").toLowerCase()
                                    return name.includes(q)
                                  })

                                  if (filtered.length === 0) {
                                    return (
                                      <div className="bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
                                        No users match your search.
                                      </div>
                                    )
                                  }

                                  return filtered.map((entry) => {
                                    const name = entry.user_profile?.name || "Unknown User"
                                    const email = entry.user_profile?.email || ""
                                    const initials = name
                                      .split(" ")
                                      .filter(Boolean)
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)

                                    return (
                                      <button
                                        key={entry.user_id}
                                        type="button"
                                        className="hover:bg-muted/30 flex w-full items-center justify-between gap-4 rounded-xl border bg-white px-4 py-4 text-left shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                        onClick={() => {
                                          setIsDetailsOpen(false)
                                          setSelectedDate(null)
                                          setSidebarUserSearch("")
                                          router.push(`/admin/reports/${entry.id}`)
                                        }}
                                      >
                                        <div className="flex min-w-0 items-center gap-4">
                                          <div className="bg-muted text-primary/80 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                                            {initials || "??"}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="truncate font-semibold">{name}</div>
                                            {email && (
                                              <div className="text-muted-foreground truncate text-xs">{email}</div>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })
                                })()}
                              </div>
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
