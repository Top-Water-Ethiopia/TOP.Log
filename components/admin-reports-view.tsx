"use client"

import { useEffect, useState, useMemo } from 'react'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Download,
  Search,
  Filter,
  Calendar,
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
  CalendarDays,
  FileDown,
  TableIcon,
  RefreshCw,
  Info,
  PlusCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO, startOfDay, subDays, subMonths } from 'date-fns'

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
  const [entries, setEntries] = useState<EnrichedEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'dashboard' | 'entries'>('dashboard')
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  
  // Filter options from API
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [allRoles, setAllRoles] = useState<Array<{ id: string; name: string }>>([])
  const [allDepartments, setAllDepartments] = useState<Array<{ id: string; name: string }>>([])
  
  // Filters
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
      console.log('=== API RESPONSE DEBUG ===')
      console.log('Full response:', data)
      console.log('Entries count:', data.entries?.length || 0)
      console.log('Users count:', data.users?.length || 0)
      console.log('Users data:', JSON.stringify(data.users, null, 2))
      console.log('Roles count:', data.roles?.length || 0)
      console.log('Departments count:', data.departments?.length || 0)
      console.log('=========================')
      
      // Handle new API response structure
      setEntries(data.entries || [])
      setAllUsers(data.users || [])
      setAllRoles(data.roles || [])
      setAllDepartments(data.departments || [])
      
      console.log('=== STATE AFTER SET ===')
      console.log('allUsers state will be:', data.users)
      console.log('========================')
      
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
    
    console.log('=== FILTERING DEBUG ===')
    console.log('Total entries:', entries.length)
    console.log('Selected user:', selectedUser)
    console.log('All users in filter:', allUsers)
    console.log('User ID types - selectedUser:', typeof selectedUser, 'entry user_id:', typeof entries[0]?.user_id)

    // Filter by user
    if (selectedUser !== 'all') {
      console.log('Filtering by user ID:', selectedUser)
      console.log('Sample entry user_id:', entries[0]?.user_id)
      console.log('All entries user_ids:', entries.map(e => e.user_id))
      filtered = filtered.filter(e => {
        const match = e.user_id === selectedUser
        console.log('Entry user_id:', e.user_id, 'Selected user:', selectedUser, 'Match:', match)
        console.log('Types - entry.user_id:', typeof e.user_id, 'selectedUser:', typeof selectedUser)
        if (e.user_profile) {
          console.log('Entry user_profile:', e.user_profile)
        } else {
          console.log('Entry has no user_profile')
        }
        return match
      })
    }
    
    console.log('Entries after user filter:', filtered.length)

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

      filtered = filtered.filter(e => parseISO(e.created_at) >= cutoffDate)
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading entries...</p>
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="entries" className="gap-2">
            <FileText className="h-4 w-4" />
            All Entries
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
                    onValueChange={(value) => {
                      console.log('Selected user ID:', value)
                      console.log('All users:', allUsers)
                      console.log('Filtering by user ID:', value)
                      console.log('User ID type:', typeof value)
                      setSelectedUser(value)
                    }}
                  >
                    <SelectTrigger id="user-filter">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {filterOptions.users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUser !== 'all' && (
                    <p className="text-xs text-muted-foreground">
                      Filtering by: {allUsers.find(u => u.id === selectedUser)?.name || selectedUser}
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
                      {filterOptions.departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
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
                      {filterOptions.roles.map(role => {
                        // Format role name for display
                        const displayName = role.name
                          .replace(/-/g, ' ')
                          .replace(/\b\w/g, char => char.toUpperCase());
                        
                        return (
                          <SelectItem key={role.id} value={role.name}>
                            {displayName}
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
                          {/* User Info */}
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
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

                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(entryDate, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{format(createdDate, 'MMM d, yyyy HH:mm')}</span>
                            </div>
                            {entry.user_profile?.role_name && (
                              <Badge variant="secondary" className="text-xs">
                                {entry.user_profile.role_name}
                              </Badge>
                            )}
                            {entry.user_profile?.department_name && (
                              <Badge variant="outline" className="text-xs">
                                {entry.user_profile.department_name}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {entry.custom_responses?.length || 0} responses
                            </Badge>
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
      </Tabs>
    </div>
  )
}
