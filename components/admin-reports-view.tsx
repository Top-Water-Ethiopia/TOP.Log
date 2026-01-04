"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Filter,
  Calendar,
  CalendarDays,
  FileText,
  BarChart3,
  Users,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TableIcon,
  RefreshCw,
  Info,
  PlusCircle,
} from "lucide-react"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import useSWR from "swr"
import {
  AdminReportsDashboardTab,
} from "@/components/features/admin-reports/admin-reports-dashboard-tab"
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
}

interface UserProfile {
  user_id: string
  name: string
  email: string
  role_name: string
  department_name: string | null
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
  const { user, profile } = useSupabaseAuth()
  const router = useRouter()
  const [selectedView, setSelectedView] = useState<"dashboard" | "entries" | "calendar">("dashboard")
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [sidebarUserSearch, setSidebarUserSearch] = useState("")
  const [calendarUserSearch, setCalendarUserSearch] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("all")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [filteredRoles, setFilteredRoles] = useState<{id: string, name: string}[]>([])

  const lastLoadErrorRef = useRef<string | null>(null)

  const {
    data,
    error: loadError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<AdminCaptainLogEntriesResponse>("/api/admin/captain-log-entries")

  const entries = useMemo(() => data?.entries ?? [], [data?.entries])
  const allUsers = useMemo(() => data?.users ?? [], [data?.users])
  const allRoles = useMemo(() => data?.roles ?? [], [data?.roles])
  const allDepartments = useMemo(() => data?.departments ?? [], [data?.departments])

  const isSuperAdmin = useMemo(() => {
    return profile?.role_id === "00000000-0000-0000-0000-000000000000"
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
    const prevExpanded = expandedEntries
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      next.delete(entryId)
      return next
    })

    const prevData = data
    mutate(
      (current) => {
        if (!current) return current
        return {
          ...current,
          entries: (current.entries || []).filter((e) => e.id !== entryId),
        }
      },
      { revalidate: false },
    )

    try {
      await apiFetch(`/api/admin/captain-log-entries/${entryId}`, { method: "DELETE" })
      toast.success("Report deleted")
      await mutate()
    } catch (error) {
      setExpandedEntries(prevExpanded)
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
    const weekAgo = subDays(now, 7)
    const monthAgo = subMonths(now, 1)
    const twoWeeksAgo = subDays(now, 14)

    const entriesThisWeek = entries.filter((e) => parseISO(e.created_at) >= weekAgo).length

    const entriesLastWeek = entries.filter((e) => {
      const date = parseISO(e.created_at)
      return date >= twoWeeksAgo && date < weekAgo
    }).length

    const entriesThisMonth = entries.filter((e) => parseISO(e.created_at) >= monthAgo).length

    const uniqueUsers = new Set(entries.map((e) => e.user_id)).size

    const totalResponses = entries.reduce((sum, e) => sum + (e.custom_responses?.length || 0), 0)
    const avgResponsesPerEntry = entries.length > 0 ? totalResponses / entries.length : 0

    // Most active users
    const userCounts = new Map<string, { name: string; count: number }>()
    entries.forEach((entry) => {
      if (entry.user_profile) {
        const current = userCounts.get(entry.user_id) || {
          name: entry.user_profile.name,
          count: 0,
        }
        userCounts.set(entry.user_id, { ...current, count: current.count + 1 })
      }
    })

    const mostActiveUsers = Array.from(userCounts.values())
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
    let roles = new Set<string>()
    
    // Filter users by department if a department is selected
    if (selectedDepartment !== "all") {
      filtered = filtered.filter(user => 
        user.department_name === selectedDepartment
      )
      
      // Get unique roles from users in the selected department
      filtered.forEach(user => {
        if (user.role_name) {
          roles.add(user.role_name)
        }
      })
      
      // Update filtered roles
      setFilteredRoles(
        allRoles.filter(role => roles.has(role.name))
      )
    } else {
      // If no department selected, show all roles
      setFilteredRoles(allRoles)
    }
    
    // If a role is selected, filter users by role
    if (selectedRole !== "all") {
      filtered = filtered.filter(user => user.role_name === selectedRole)
    }
    
    setFilteredUsers(filtered)
    
    // Reset user selection if current selection is no longer valid
    if (selectedUser !== "all" && !filtered.some(u => u.user_id === selectedUser)) {
      setSelectedUser("all")
    }
    
  }, [allUsers, allRoles, selectedDepartment, selectedRole, selectedUser])
  
  // Get departments that have at least one role assigned
  const departmentsWithRoles = useMemo(() => {
    // Create a set of department names that have roles
    const deptWithRoles = new Set(
      allRoles.map(role => 
        allDepartments.find(d => d.id === role.id)?.name
      ).filter(Boolean)
    )
    
    // Filter departments to only those with roles
    return allDepartments.filter(dept => dept.name && deptWithRoles.has(dept.name))
  }, [allDepartments, allRoles])

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    return {
      users: filteredUsers,
      departments: departmentsWithRoles,
      roles: filteredRoles,
    }
  }, [filteredUsers, departmentsWithRoles, filteredRoles])

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
    let filtered = [...entries]
    const normalizedSelectedUser = String(selectedUser).trim()

    // Filter by user (if selected, this takes highest priority)
    if (selectedUser !== "all") {
      return filtered.filter((e) => String(e.user_id).trim() === normalizedSelectedUser)
    }
    
    // If no user selected, apply department and role filters
    if (selectedDepartment !== "all") {
      filtered = filtered.filter((e) => e.user_profile?.department_name === selectedDepartment)
      
      // If role is also selected, filter by role within the department
      if (selectedRole !== "all") {
        filtered = filtered.filter((e) => e.user_profile?.role_name === selectedRole)
      }
    } else if (selectedRole !== "all") {
      // If only role is selected (no department), filter by role
      filtered = filtered.filter((e) => e.user_profile?.role_name === selectedRole)
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date()
      let cutoffDate: Date

      switch (dateRange) {
        case "today":
          cutoffDate = startOfDay(now)
          break
        case "week":
          cutoffDate = subDays(now, 7)
          break
        case "month":
          cutoffDate = subMonths(now, 1)
          break
        case "quarter":
          cutoffDate = subMonths(now, 3)
          break
        default:
          cutoffDate = new Date(0)
      }

      filtered = filtered.filter((e) => {
        const compareDate = e.date ? parseISO(e.date) : parseISO(e.created_at)
        return compareDate >= cutoffDate
      })
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((entry) => {
        // Search in user name
        if (entry.user_profile?.name.toLowerCase().includes(query)) return true
        if (entry.user_profile?.email.toLowerCase().includes(query)) return true

        // Search in custom responses
        return entry.custom_responses?.some(
          (response) =>
            String(response.value).toLowerCase().includes(query) ||
            response.question_label?.toLowerCase().includes(query) ||
            response.question_key?.toLowerCase().includes(query)
        )
      })
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [entries, selectedUser, selectedDepartment, selectedRole, dateRange, searchQuery])

  // Toggle entry expansion
  const toggleEntry = (entryId: string) => {
    const newExpanded = new Set(expandedEntries)
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId)
    } else {
      newExpanded.add(entryId)
    }
    setExpandedEntries(newExpanded)
  }

  // Export functions
  const exportToCSV = () => {
    try {
      // CSV header
      let csv = "Date,User,Email,Department,Role,Question,Answer,Created At\n"

      // CSV rows
      filteredEntries.forEach((entry) => {
        const user = entry.user_profile?.name || "Unknown"
        const email = entry.user_profile?.email || "Unknown"
        const dept = entry.user_profile?.department_name || "N/A"
        const role = entry.user_profile?.role_name || "N/A"
        const date = entry.date
        const createdAt = entry.created_at

        entry.custom_responses?.forEach((response) => {
          const question = (response.question_label || response.question_key).replace(/"/g, '""')
          const answer = String(response.value).replace(/"/g, '""')
          csv += `"${date}","${user}","${email}","${dept}","${role}","${question}","${answer}","${createdAt}"\n`
        })
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
    } catch (error) {
      toast.error("Failed to export CSV")
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("")
    setSelectedUser("all")
    setSelectedDepartment("all")
    setSelectedRole("all")
    setDateRange("all")
    setFilteredUsers(allUsers)
    setFilteredRoles(allRoles)
  }

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
          {/* Filters */}
          <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="text-muted-foreground h-5 w-5" />
                <span className="text-muted-foreground">Filters & Search</span>
              </CardTitle>
              <CardDescription>
                {filteredEntries.length} of {entries.length} entries
                {(searchQuery ||
                  selectedUser !== "all" ||
                  selectedDepartment !== "all" ||
                  selectedRole !== "all" ||
                  dateRange !== "all") &&
                  " (filtered)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 transform" />
                  <Input
                    id="search"
                    placeholder="Search by user, email, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12"
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Department Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dept-filter">Department</Label>
                  <Select 
                    value={selectedDepartment} 
                    onValueChange={(value) => {
                      setSelectedDepartment(value);
                      // Reset role and user when department changes
                      setSelectedRole("all");
                      setSelectedUser("all");
                    }}
                  >
                    <SelectTrigger id="dept-filter" className="min-w-[180px]">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="text-muted-foreground font-semibold">All Departments</span>
                      </SelectItem>
                      {departmentsWithRoles.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Role Filter - Disabled if no department selected */}
                <div className="space-y-2">
                  <Label htmlFor="role-filter">
                    Role
                    {selectedDepartment === "all" && (
                      <span className="ml-2 text-xs text-muted-foreground">(select department first)</span>
                    )}
                  </Label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={(value) => {
                      setSelectedRole(value);
                      // Reset user when role changes
                      setSelectedUser("all");
                    }}
                    disabled={selectedDepartment === "all"}
                  >
                    <SelectTrigger id="role-filter" className="min-w-[160px]">
                      <SelectValue placeholder={
                        selectedDepartment === "all" ? "Select department first" : "All roles"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="text-muted-foreground font-semibold">All Roles</span>
                      </SelectItem>
                      {filteredRoles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Filter - Disabled if no department selected */}
                <div className="space-y-2">
                  <Label htmlFor="user-filter">
                    User
                    {selectedDepartment === "all" && (
                      <span className="ml-2 text-xs text-muted-foreground">(select department first)</span>
                    )}
                  </Label>
                  <Select 
                    value={selectedUser} 
                    onValueChange={setSelectedUser}
                    disabled={selectedDepartment === "all"}
                  >
                    <SelectTrigger id="user-filter" className="min-w-[180px]">
                      <SelectValue placeholder={
                        selectedDepartment === "all" ? "Select department first" : 
                        filteredUsers.length === 0 ? "No users found" : "All users"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="text-muted-foreground font-semibold">All Users</span>
                      </SelectItem>
                      {filteredUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <Label htmlFor="date-filter">Date Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger id="date-filter">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="text-muted-foreground font-semibold">All time</span>
                      </SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 days</SelectItem>
                      <SelectItem value="month">Last 30 days</SelectItem>
                      <SelectItem value="quarter">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                {/* Clear Filters */}
                {(searchQuery ||
                  selectedUser !== "all" ||
                  selectedDepartment !== "all" ||
                  selectedRole !== "all" ||
                  dateRange !== "all") && (
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                      <Filter className="h-4 w-4" />
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>

              {/* Export Actions */}
              <Separator />
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={filteredEntries.length === 0}
                >
                  <TableIcon className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

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
                    <>
                      <Link href="/">
                        <Button className="gap-2">
                          <PlusCircle className="h-4 w-4" />
                          Create Entry
                        </Button>
                      </Link>
                      <Link href="/admin/users">
                        <Button variant="outline" className="gap-2">
                          <Users className="h-4 w-4" />
                          Manage Users
                        </Button>
                      </Link>
                    </>
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
              {filteredEntries.map((entry) => {
                const isExpanded = expandedEntries.has(entry.id)
                const entryDate = parseISO(entry.date)
                const createdDate = parseISO(entry.created_at)

                return (
                  <Card
                    key={entry.id}
                    className="overflow-hidden border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md"
                  >
                    <CardHeader
                      className="cursor-pointer p-4 transition-colors duration-150 ease-in-out hover:bg-gray-50"
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          {/* User Info - MODIFIED FOR INITIALS AND SIMPLIFIED LAYOUT */}
                          <div className="mb-2 flex items-center gap-4">
                            {/* Replaced generic User icon with Initials placeholder (similar to Image 2) */}
                            <div className="bg-muted text-primary/80 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                              {entry.user_profile?.name
                                ? entry.user_profile.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .substring(0, 2)
                                : "??"}
                            </div>
                            <div className="min-w-0 flex-1">
                              {/* Name and Email side-by-side, or stacked if necessary */}
                              <div className="flex items-baseline gap-2">
                                <div className="truncate font-semibold">
                                  {entry.user_profile?.name || "Unknown User"}
                                </div>
                                {entry.user_profile?.email && (
                                  <div className="text-muted-foreground truncate text-sm">
                                    {entry.user_profile.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Metadata - MODIFIED FOR IMAGE 2 LAYOUT */}
                          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                            {/* Entry Date (no icon) */}
                            <div className="flex items-center gap-2">
                              <span>{format(entryDate, "MMM d, yyyy")}</span>
                            </div>

                            {/* Entry Time (no icon) - Assuming this is the '11:27' time shown in Image 2. */}
                            {/* Note: The format in the original code's Clock element was 'MMM d, yyyy HH:mm', 
                       but Image 2 shows only the time/date next to the first date. We'll show the time here. */}
                            <div className="flex items-center gap-2">
                              <span>{format(createdDate, "HH:mm")}</span>
                            </div>

                            {/* RETAINED Badge: Responses (Pushed to new line if space is limited) */}
                            <Badge variant="outline" className="text-xs">
                              {entry.custom_responses?.length || 0} responses
                            </Badge>

                            {/* REMOVED Badges: role_name and department_name to simplify the layout */}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-2 h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleEntry(entry.id)
                          }}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="px-4 pt-0 pb-4">
                        <Separator className="mb-4" />
                        <div className="mb-4 flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/admin/reports/${entry.id}`)
                            }}
                          >
                            View
                          </Button>
                          {isSuperAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                >
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete report?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.preventDefault()
                                      deleteEntry(entry.id)
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                        <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
                          {entry.custom_responses && entry.custom_responses.length > 0 ? (
                            entry.custom_responses.map((response, index) => (
                              <div key={index} className="space-y-2">
                                <h4 className="text-foreground text-sm font-semibold">
                                  {response.question_label || response.question_key}
                                </h4>
                                <div className="text-muted-foreground bg-muted/50 max-h-40 overflow-y-auto rounded-md p-4 text-sm">
                                  {typeof response.value === "string" ? (
                                    <p className="whitespace-pre-wrap">{response.value}</p>
                                  ) : (
                                    <pre className="overflow-auto text-xs">
                                      {JSON.stringify(response.value, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground text-sm italic">
                              No responses submitted for this entry.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Enhanced Calendar View Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card className="border border-gray-200 bg-transparent shadow-lg transition-shadow duration-300 hover:shadow-xl">
            <CardHeader className="pb-2">
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
            </CardHeader>
            <CardContent className="bg-transparent pt-2">
              {/* Advanced Calendar Filters - Responsive */}
              <div className={`${styles.filterPanel} ${styles.animateSlideIn}`}>
                <h3 className={styles.filterTitle}>Advanced Filters</h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  {/* Department Filter - Always shown */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-dept-filter" className="hidden text-sm text-gray-700 sm:block">
                      Dept:
                    </Label>
                    <Select 
                      value={selectedDepartment} 
                      onValueChange={(value) => {
                        setSelectedDepartment(value);
                        setSelectedRole("all");
                        setSelectedUser("all");
                      }}
                    >
                      <SelectTrigger id="cal-dept-filter" className="h-8 w-24 sm:w-32">
                        <SelectValue placeholder="All depts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="text-muted-foreground font-semibold">All Departments</span>
                        </SelectItem>
                        {allDepartments
                          .filter((dept) => dept && dept.name)
                          .map((dept) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Filter - Disabled if no department selected */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-role-filter" className="hidden text-sm text-gray-700 sm:block">
                      Role:
                    </Label>
                    <Select 
                      value={selectedRole} 
                      onValueChange={(value) => {
                        setSelectedRole(value);
                        setSelectedUser("all");
                      }}
                      disabled={selectedDepartment === "all"}
                    >
                      <SelectTrigger id="cal-role-filter" className="h-8 w-24 sm:w-32">
                        <SelectValue placeholder={
                          selectedDepartment === "all" ? "Select dept" : "All roles"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="text-muted-foreground font-semibold">All Roles</span>
                        </SelectItem>
                        {filteredRoles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* User Filter - Disabled if no department selected */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-user-filter" className="hidden text-sm text-gray-700 sm:block">
                      User:
                    </Label>
                    {(() => {
                      const enableUserSearch = userOptions.length >= 15
                      const enableUserScroll = userOptions.length >= 12
                      const q = calendarUserSearch.trim().toLowerCase()
                      const filteredUserOptions = enableUserSearch
                        ? userOptions.filter((user) => {
                            if (!q) return true
                            const name = (user.name || "").toLowerCase()
                            const dept = (user.department_name || "").toLowerCase()
                            return name.includes(q) || dept.includes(q)
                          })
                        : userOptions

                      return (
                    <Select 
                      value={selectedUser} 
                      onValueChange={setSelectedUser}
                      onOpenChange={(open) => {
                        if (!open) setCalendarUserSearch("")
                      }}
                    >
                      <SelectTrigger id="cal-user-filter" className="h-8 w-24 sm:w-32">
                        <SelectValue placeholder={
                          userOptions.length === 0 ? "No users found" : "All users"
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-[360px] overflow-hidden">
                        <SelectItem value="all">
                          <span className="font-semibold">All Users</span>
                        </SelectItem>
                        {enableUserSearch && (
                          <div className="sticky top-0 z-10 border-b bg-white/95 p-2 backdrop-blur">
                            <Input
                              value={calendarUserSearch}
                              onChange={(e) => setCalendarUserSearch(e.target.value)}
                              placeholder="Search users..."
                              className="h-8"
                            />
                          </div>
                        )}
                        {userOptions.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No users found
                          </SelectItem>
                        ) : enableUserSearch && filteredUserOptions.length === 0 ? (
                          <SelectItem value="__no_match__" disabled>
                            No users match your search
                          </SelectItem>
                        ) : (
                          <div className={enableUserScroll ? "max-h-[280px] overflow-y-auto pr-2" : undefined}>
                            {filteredUserOptions.map((user, index) => (
                              <SelectItem key={`${user.user_id}-${index}`} value={user.user_id}>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-muted-foreground truncate text-xs">{user.department_name}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                      )
                    })()}
                  </div>

                  {/* Date Range Filter */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-date-filter" className="hidden text-sm text-gray-700 sm:block">
                      Period:
                    </Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger id="cal-date-filter" className="h-8 w-20 sm:w-28">
                        <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="text-muted-foreground font-semibold">All time</span>
                        </SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">7 days</SelectItem>
                        <SelectItem value="month">30 days</SelectItem>
                        <SelectItem value="quarter">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Export Buttons - Stacked on mobile */}
                  <div className="flex items-center space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={exportToCSV}
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2 border-gray-300 px-2 text-xs"
                          disabled={filteredEntries.length === 0}
                        >
                          <TableIcon className="h-3 w-3" />
                          <span className="xs:inline hidden">CSV</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Export as CSV</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Clear Filters Button */}
                  {(selectedUser !== "all" ||
                    selectedDepartment !== "all" ||
                    selectedRole !== "all" ||
                    dateRange !== "all") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-8 gap-2 px-2 text-xs"
                        >
                          <Filter className="h-3 w-3" />
                          <span className="xs:inline hidden">Clear</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Clear all calendar filters</TooltipContent>
                    </Tooltip>
                  )}
                </div>
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
                    <Button className="h-8 bg-indigo-600 text-white hover:bg-indigo-700 sm:h-9">
                      <PlusCircle className="mr-2 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">Create Report</span>
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
