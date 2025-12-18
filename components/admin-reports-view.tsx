"use client"

import { useEffect, useState, useMemo } from 'react'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Download,
  Search,
  Filter,
  Calendar,
  CalendarDays,
  User,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Clock,
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
  ExternalLink,
  Building2,
  Shield
} from 'lucide-react'
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
} from 'date-fns'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import styles from './admin-reports-view.module.css'

// Types
interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: any
}

interface CaptainLogEntry {
  id: string
  user_id: string
  date: string
  created_at: string
  updated_at: string
  version: number
  metadata: any
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

interface DashboardStats {
  totalEntries: number
  totalUsers: number
  entriesThisWeek: number
  entriesThisMonth: number
  avgResponsesPerEntry: number
  mostActiveUsers: Array<{ name: string; count: number }>
  entryTrend: 'up' | 'down' | 'stable'
}

/**
 * Admin Reports View - Enterprise-grade reporting interface
 * Following Fortune 500 standards for data visualization and user experience
 */
export function AdminReportsView() {
  const { user } = useSupabaseAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<EnrichedEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'dashboard' | 'entries' | 'calendar'>('dashboard')
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [allRoles, setAllRoles] = useState<{ id: string; name: string }[]>([])
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string }[]>([])
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<string>('all')

  // Load all entries with user profiles
  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/captain-log-entries')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // Handle new API response structure
      setEntries(data.entries || [])
      setAllUsers(data.users || [])
      setAllRoles(data.roles || [])
      setAllDepartments(data.departments || [])
      
      toast.success(`Loaded ${data.entries?.length || 0} entries, ${data.users?.length || 0} users`)
    } catch (error) {
      console.error('Error loading entries:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load entries')
      setEntries([])
      setAllUsers([])
      setAllRoles([])
      setAllDepartments([])
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate dashboard statistics
  const stats: DashboardStats = useMemo(() => {
    const now = new Date()
    const weekAgo = subDays(now, 7)
    const monthAgo = subMonths(now, 1)
    const twoWeeksAgo = subDays(now, 14)

    const entriesThisWeek = entries.filter(e => 
      parseISO(e.created_at) >= weekAgo
    ).length

    const entriesLastWeek = entries.filter(e => {
      const date = parseISO(e.created_at)
      return date >= twoWeeksAgo && date < weekAgo
    }).length

    const entriesThisMonth = entries.filter(e =>
      parseISO(e.created_at) >= monthAgo
    ).length

    const uniqueUsers = new Set(entries.map(e => e.user_id)).size

    const totalResponses = entries.reduce((sum, e) => 
      sum + (e.custom_responses?.length || 0), 0
    )
    const avgResponsesPerEntry = entries.length > 0 
      ? totalResponses / entries.length 
      : 0

    // Most active users
    const userCounts = new Map<string, { name: string; count: number }>()
    entries.forEach(entry => {
      if (entry.user_profile) {
        const current = userCounts.get(entry.user_id) || { 
          name: entry.user_profile.name, 
          count: 0 
        }
        userCounts.set(entry.user_id, { ...current, count: current.count + 1 })
      }
    })

    const mostActiveUsers = Array.from(userCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (entriesThisWeek > entriesLastWeek * 1.1) trend = 'up'
    else if (entriesThisWeek < entriesLastWeek * 0.9) trend = 'down'

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

  // Get unique values for filters - now from API data
  const filterOptions = useMemo(() => {
    return {
      users: allUsers,
      departments: allDepartments,
      roles: allRoles,
    }
  }, [allUsers, allDepartments, allRoles])

  // Filter entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries]
    const normalizedSelectedUser = String(selectedUser).trim()

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter((e) => String(e.user_id).trim() === normalizedSelectedUser)
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(e => 
        e.user_profile?.department_name === selectedDepartment
      )
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(e =>
        e.user_profile?.role_name === selectedRole
      )
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date()
      let cutoffDate: Date

      switch (dateRange) {
        case 'today':
          cutoffDate = startOfDay(now)
          break
        case 'week':
          cutoffDate = subDays(now, 7)
          break
        case 'month':
          cutoffDate = subMonths(now, 1)
          break
        case 'quarter':
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
      filtered = filtered.filter(entry => {
        // Search in user name
        if (entry.user_profile?.name.toLowerCase().includes(query)) return true
        if (entry.user_profile?.email.toLowerCase().includes(query)) return true
        
        // Search in custom responses
        return entry.custom_responses?.some(response =>
          String(response.value).toLowerCase().includes(query) ||
          response.question_label?.toLowerCase().includes(query) ||
          response.question_key?.toLowerCase().includes(query)
        )
      })
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
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
  const exportToJSON = () => {
    try {
      const exportData = filteredEntries.map(entry => ({
        date: entry.date,
        user: entry.user_profile?.name || 'Unknown',
        email: entry.user_profile?.email || 'Unknown',
        department: entry.user_profile?.department_name || 'N/A',
        role: entry.user_profile?.role_name || 'N/A',
        created_at: entry.created_at,
        responses: entry.custom_responses?.map(r => ({
          question: r.question_label || r.question_key,
          answer: r.value,
        })) || [],
      }))

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `captain-log-entries-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${filteredEntries.length} entries`)
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  const exportToCSV = () => {
    try {
      // CSV header
      let csv = 'Date,User,Email,Department,Role,Question,Answer,Created At\n'

      // CSV rows
      filteredEntries.forEach(entry => {
        const user = entry.user_profile?.name || 'Unknown'
        const email = entry.user_profile?.email || 'Unknown'
        const dept = entry.user_profile?.department_name || 'N/A'
        const role = entry.user_profile?.role_name || 'N/A'
        const date = entry.date
        const createdAt = entry.created_at

        entry.custom_responses?.forEach(response => {
          const question = (response.question_label || response.question_key).replace(/"/g, '""')
          const answer = String(response.value).replace(/"/g, '""')
          csv += `"${date}","${user}","${email}","${dept}","${role}","${question}","${answer}","${createdAt}"\n`
        })
      })

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `captain-log-entries-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${filteredEntries.length} entries to CSV`)
    } catch (error) {
      toast.error('Failed to export CSV')
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedUser('all')
    setSelectedDepartment('all')
    setSelectedRole('all')
    setDateRange('all')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 bg-gray-200/80 dark:bg-gray-800" />
            <Skeleton className="h-4 w-40 bg-gray-200/70 dark:bg-gray-800" />
          </div>
          <Skeleton className="h-9 w-32 bg-gray-200/80 dark:bg-gray-800" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
              <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
              <Skeleton className="h-8 w-20 bg-gray-200/80 dark:bg-gray-800" />
              <Skeleton className="h-3 w-32 bg-gray-200/60 dark:bg-gray-800" />
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-44 bg-gray-200/80 dark:bg-gray-800" />
            </div>
            <Skeleton className="h-9 w-28 bg-gray-200/80 dark:bg-gray-800" />
          </div>
          <div className="space-y-3">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Individual Reports</h2>
          <p className="text-muted-foreground">
            {entries.length} total {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadEntries}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Data
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
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
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEntries}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {stats.totalUsers} users
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.entriesThisWeek}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stats.entryTrend === 'up' && (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">Increasing</span>
                    </>
                  )}
                  {stats.entryTrend === 'down' && (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-red-600">Decreasing</span>
                    </>
                  )}
                  {stats.entryTrend === 'stable' && (
                    <span>Stable trend</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.entriesThisMonth}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 30 days
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Responses</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.avgResponsesPerEntry.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per entry
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Most Active Users */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Most Active Contributors</span>
              </CardTitle>
              <CardDescription>
                Top users by number of entries submitted
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.mostActiveUsers.length > 0 ? (
                <div className="space-y-3">
                  {stats.mostActiveUsers.map((user, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                          {index + 1}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                      <Badge variant="secondary">{user.count} entries</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No data available</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Quick Actions</CardTitle>
              <CardDescription>Export and analyze data</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={exportToJSON} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
              <Button onClick={exportToCSV} variant="outline" className="gap-2">
                <TableIcon className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                onClick={() => setSelectedView('entries')}
                variant="default"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                View All Entries
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-6">
          {/* Filters */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Filters & Search</span>
              </CardTitle>
              <CardDescription>
                {filteredEntries.length} of {entries.length} entries
                {(searchQuery || selectedUser !== 'all' || selectedDepartment !== 'all' || 
                  selectedRole !== 'all' || dateRange !== 'all') && ' (filtered)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by user, email, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* User Filter */}
                <div className="space-y-2">
                  <Label htmlFor="user-filter">User</Label>
                  <Select 
                    value={selectedUser} 
                    onValueChange={setSelectedUser}
                  >
                    <SelectTrigger id="user-filter">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {filterOptions.users
                        .filter((user, index, self) => 
                          user.user_id && self.findIndex(u => u.user_id === user.user_id) === index
                        )
                        .map(user => (
                          <SelectItem key={`${user.user_id}-${user.email}`} value={user.user_id}>
                            <span className="truncate">{user.name} ({user.email})</span>
                          </SelectItem>
                        ))}
                    </SelectContent>

                  </Select>
                  {selectedUser !== 'all' && (
                    <p className="text-xs text-muted-foreground">
                      Filtering by: {allUsers.find(u => u.user_id === selectedUser)?.name || selectedUser}
                    </p>
                  )}
                </div>

                {/* Department Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dept-filter">Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger id="dept-filter">
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {filterOptions.departments
                        .filter((dept, index, self) => 
                          dept.id && dept.name && self.findIndex(d => d.id === dept.id) === index
                        )
                        .map(dept => (
                          <SelectItem key={`${dept.id}-${dept.name}`} value={dept.name}>
                            <span className="truncate">{dept.name}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>

                  </Select>
                </div>

                {/* Role Filter */}
                <div className="space-y-2">
                  <Label htmlFor="role-filter">Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger id="role-filter">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {filterOptions.roles
                        .filter((role, index, self) => 
                          role.id && role.name && self.findIndex(r => r.id === role.id) === index
                        )
                        .map(role => {
                          // Format role name for display
                          const displayName = role.name
                            .replace(/-/g, ' ')
                            .replace(/\b\w/g, char => char.toUpperCase());
                            
                          return (
                            <SelectItem key={`${role.id}-${role.name}`} value={role.name}>
                              <span className="truncate">{displayName}</span>
                            </SelectItem>
                          );
                        })}
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
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 days</SelectItem>
                      <SelectItem value="month">Last 30 days</SelectItem>
                      <SelectItem value="quarter">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(searchQuery || selectedUser !== 'all' || selectedDepartment !== 'all' ||
                selectedRole !== 'all' || dateRange !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear all filters
                </Button>
              )}

              {/* Export Actions */}
              <Separator />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={exportToJSON}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={filteredEntries.length === 0}
                >
                  <FileDown className="h-4 w-4" />
                  Export JSON
                </Button>
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
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {entries.length === 0 ? 'No Entries Yet' : 'No entries match your filters'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {entries.length === 0
                    ? 'No users have created captain log entries yet.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
                
                {entries.length === 0 && (
                  <div className="bg-muted p-6 rounded-lg max-w-2xl mx-auto text-left mb-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      How users create entries:
                    </h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="font-bold min-w-[20px]">1.</span>
                        <span>Users login to their account</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold min-w-[20px]">2.</span>
                        <span>Navigate to the main dashboard (Home page)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold min-w-[20px]">3.</span>
                        <span>Click any date on the calendar</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold min-w-[20px]">4.</span>
                        <span>Fill out role-specific questions</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold min-w-[20px]">5.</span>
                        <span>Submit the entry</span>
                      </li>
                    </ol>
                  </div>
                )}
                
                <div className="flex gap-3 justify-center">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                    >
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
                  <Card key={entry.id} className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
    <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors p-4"
        onClick={() => toggleEntry(entry.id)}
    >
        <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
                {/* User Info - MODIFIED FOR INITIALS AND SIMPLIFIED LAYOUT */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Replaced generic User icon with Initials placeholder (similar to Image 2) */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-primary/80">
                        {entry.user_profile?.name ? entry.user_profile.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                        {/* Name and Email side-by-side, or stacked if necessary */}
                        <div className="flex items-baseline gap-2">
                            <div className="font-semibold truncate">
                                {entry.user_profile?.name || 'Unknown User'}
                            </div>
                            {entry.user_profile?.email && (
                                <div className="text-sm text-muted-foreground truncate">
                                    {entry.user_profile.email}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Metadata - MODIFIED FOR IMAGE 2 LAYOUT */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {/* Entry Date (no icon) */}
                    <div className="flex items-center gap-1">
                        <span>{format(entryDate, 'MMM d, yyyy')}</span>
                    </div>

                    {/* Entry Time (no icon) - Assuming this is the '11:27' time shown in Image 2. */}
                    {/* Note: The format in the original code's Clock element was 'MMM d, yyyy HH:mm', 
                       but Image 2 shows only the time/date next to the first date. We'll show the time here. */}
                    <div className="flex items-center gap-1">
                        <span>{format(createdDate, 'HH:mm')}</span>
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
                className="h-8 w-8 ml-2 flex-shrink-0"
                onClick={(e) => {
                    e.stopPropagation()
                    toggleEntry(entry.id)
                }}
            >
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                ) : (
                    <ChevronDown className="h-4 w-4" />
                )}
            </Button>
        </div>
    </CardHeader>

    {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
            <Separator className="mb-4" />
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {entry.custom_responses && entry.custom_responses.length > 0 ? (
                    entry.custom_responses.map((response, index) => (
                        <div key={index} className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">
                                {response.question_label || response.question_key}
                            </h4>
                            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md max-h-40 overflow-y-auto">
                                {typeof response.value === 'string' ? (
                                    <p className="whitespace-pre-wrap">{response.value}</p>
                                ) : (
                                    <pre className="text-xs overflow-auto">
                                        {JSON.stringify(response.value, null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground italic">
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
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className={`${styles.calendarHeader} pb-4`}>
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h2 className={styles.calendarTitle}>Reports Calendar</h2>
                  <p className={styles.calendarSubtitle}>
                    Enterprise-grade calendar view with advanced filtering and analytics
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <div className="mr-2 h-3 w-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
                      <span className="hidden sm:inline">Team Member</span>
                      <span className="sm:hidden">TM</span>
                    </div>
                    <div className="flex items-center">
                      <div className="mr-2 h-3 w-3 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700"></div>
                      <span className="hidden sm:inline">Admin</span>
                      <span className="sm:hidden">A</span>
                    </div>
                    <div className="flex items-center">
                      <div className="mr-2 h-3 w-3 rounded-full bg-gradient-to-r from-orange-400 to-red-500"></div>
                      <span className="hidden sm:inline">High Activity</span>
                      <span className="sm:hidden">HA</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 shadow-sm"
                    onClick={loadEntries}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden xs:inline">Refresh Data</span>
                    <span className="xs:hidden">Refresh</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Advanced Calendar Filters - Responsive */}
              <div className={`${styles.filterPanel} ${styles.animateSlideIn}`}>
                <h3 className={styles.filterTitle}>Advanced Filters</h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* User Filter */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-user-filter" className="text-sm text-gray-700 hidden sm:block">User:</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger id="cal-user-filter" className="h-8 w-24 sm:w-32">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        {filterOptions.users
                          .filter((user, index, self) =>
                            user.user_id && self.findIndex(u => u.user_id === user.user_id) === index
                          )
                          .map(user => (
                            <SelectItem key={`${user.user_id}-${user.email}`} value={user.user_id}>
                              <span className="truncate">{user.name} ({user.email})</span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Filter */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-dept-filter" className="text-sm text-gray-700 hidden sm:block">Dept:</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger id="cal-dept-filter" className="h-8 w-24 sm:w-32">
                        <SelectValue placeholder="All depts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {filterOptions.departments
                          .filter((dept, index, self) =>
                            dept.id && dept.name && self.findIndex(d => d.id === dept.id) === index
                          )
                          .map(dept => (
                            <SelectItem key={`${dept.id}-${dept.name}`} value={dept.name}>
                              <span className="truncate">{dept.name}</span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Filter - Hidden on mobile */}
                  <div className="hidden sm:flex items-center space-x-2">
                    <Label htmlFor="cal-role-filter" className="text-sm text-gray-700">Role:</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger id="cal-role-filter" className="h-8 w-32">
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        {filterOptions.roles
                          .filter((role, index, self) =>
                            role.id && role.name && self.findIndex(r => r.id === role.id) === index
                          )
                          .map(role => {
                            // Format role name for display
                            const displayName = role.name
                              .replace(/-/g, ' ')
                              .replace(/\b\w/g, char => char.toUpperCase());

                            return (
                              <SelectItem key={`${role.id}-${role.name}`} value={role.name}>
                                <span className="truncate">{displayName}</span>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>

                    </Select>
                  </div>

                  {/* Date Range Filter */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cal-date-filter" className="text-sm text-gray-700 hidden sm:block">Period:</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger id="cal-date-filter" className="h-8 w-20 sm:w-28">
                        <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">7 days</SelectItem>
                        <SelectItem value="month">30 days</SelectItem>
                        <SelectItem value="quarter">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Export Buttons - Stacked on mobile */}
                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={exportToJSON}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs border-gray-300"
                      disabled={filteredEntries.length === 0}
                    >
                      <FileDown className="h-3 w-3" />
                      <span className="hidden xs:inline">JSON</span>
                    </Button>
                    <Button
                      onClick={exportToCSV}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs border-gray-300"
                      disabled={filteredEntries.length === 0}
                    >
                      <TableIcon className="h-3 w-3" />
                      <span className="hidden xs:inline">CSV</span>
                    </Button>
                  </div>

                  {/* Clear Filters Button */}
                  {(selectedUser !== 'all' || selectedDepartment !== 'all' ||
                    selectedRole !== 'all' || dateRange !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 gap-1 px-2 text-xs"
                    >
                      <Filter className="h-3 w-3" />
                      <span className="hidden xs:inline">Clear</span>
                    </Button>
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
                  <h3 className={styles.emptyTitle}>{entries.length === 0 ? 'No reports found' : 'No reports match your filters'}</h3>
                  <p className={styles.emptySubtitle}>
                    {entries.length === 0
                      ? 'There are no reports to display. Reports will appear here once submitted by team members.'
                      : 'Try adjusting your filters to see reports for other users, departments, roles, or time periods.'}
                  </p>
                  <div className="flex space-x-3 sm:space-x-4">
                    <Button variant="outline" onClick={loadEntries} className="border-gray-300 text-gray-700 h-8 sm:h-9">
                      <RefreshCw className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                      <span className="text-xs sm:text-sm">Refresh</span>
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 sm:h-9">
                      <PlusCircle className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
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

                  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
                  const selectedEntries = selectedDateKey ? (entriesByDate.get(selectedDateKey) || []) : []
                  const uniqueUsersForSelectedDate = (() => {
                    const map = new Map<string, EnrichedEntry>()
                    for (const entry of selectedEntries) {
                      if (!map.has(entry.user_id)) map.set(entry.user_id, entry)
                    }
                    return Array.from(map.values()).sort((a, b) => {
                      const an = a.user_profile?.name || ''
                      const bn = b.user_profile?.name || ''
                      return an.localeCompare(bn)
                    })
                  })()

                  return (
                    <div className="rounded-xl border border-gray-300 bg-white shadow-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, 1)))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          <div className="text-base sm:text-lg font-semibold text-gray-900">
                            {format(calendarMonth, 'MMMM yyyy')}
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

                      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                          <div key={label} className="py-2 text-center">
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 auto-rows-[92px] sm:auto-rows-[110px]">
                        {days.map((day) => {
                          const dayKey = format(day, 'yyyy-MM-dd')
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
                                (!isInMonth ? 'bg-gray-50/60 text-gray-400' : 'bg-white text-gray-900') +
                                (isSelected ? ' ring-2 ring-inset ring-blue-500 bg-blue-50/50' : '')
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
                                    (isToday ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700')
                                  }
                                >
                                  {format(day, 'd')}
                                </div>
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
                          if (!open) setSelectedDate(null)
                        }}
                      >
                        <SheetContent className="sm:max-w-md">
                          <SheetHeader>
                            <SheetTitle>
                              {selectedDate
                                ? `Reports for ${format(selectedDate, 'MMMM d, yyyy')}`
                                : 'Reports'}
                            </SheetTitle>
                          </SheetHeader>

                          <div className="px-4 pb-4">
                            {selectedDate && uniqueUsersForSelectedDate.length === 0 ? (
                              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                                No reports for this date.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {uniqueUsersForSelectedDate.map((entry) => {
                                  const name = entry.user_profile?.name || 'Unknown User'
                                  const email = entry.user_profile?.email || ''
                                  const initials = name
                                    .split(' ')
                                    .filter(Boolean)
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)

                                  return (
                                    <button
                                      key={entry.user_id}
                                      type="button"
                                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 text-left shadow-sm hover:bg-muted/30 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                      onClick={() => {
                                        setIsDetailsOpen(false)
                                        setSelectedDate(null)
                                        router.push(`/admin/reports/${entry.id}`)
                                      }}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary/80">
                                          {initials || '??'}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold truncate">{name}</div>
                                          {email && (
                                            <div className="text-xs text-muted-foreground truncate">{email}</div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
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
