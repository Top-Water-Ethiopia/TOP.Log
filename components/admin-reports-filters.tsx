"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, TableIcon, CalendarDays, Users, Building2, Briefcase, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { format, parseISO } from "date-fns"

interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
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

interface Department {
  id: string
  name: string
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

interface AdminReportsFiltersProps {
  // Data
  entries: CaptainLogEntry[]
  allDepartments: Department[]
  filteredUsers: UserProfile[]
  uniqueProfessionalRoles: string[]
  userOptions: UserProfile[]

  // State
  searchQuery: string
  selectedUser: string
  selectedDepartment: string
  selectedRole: string
  dateRange: string
  customDateRange: { start: string; end: string }
  calendarUserSearch: string

  // Callbacks
  setSearchQuery: (query: string) => void
  setSelectedUser: (user: string) => void
  setSelectedDepartment: (dept: string) => void
  setSelectedRole: (role: string) => void
  setDateRange: (range: string) => void
  setCustomDateRange: (callback: (prev: { start: string; end: string }) => { start: string; end: string }) => void
  setCalendarUserSearch: (search: string) => void
  clearFilters: () => void
  exportToCSV: () => void
  exportToExcel: () => void

  // UI Options
  variant?: "entries" | "calendar"
  filteredEntriesCount?: number
  hasActiveFilters?: boolean
}

export function AdminReportsFilters({
  entries,
  allDepartments,
  filteredUsers,
  uniqueProfessionalRoles,
  userOptions,
  searchQuery,
  selectedUser,
  selectedDepartment,
  selectedRole,
  dateRange,
  customDateRange,
  calendarUserSearch,
  setSearchQuery,
  setSelectedUser,
  setSelectedDepartment,
  setSelectedRole,
  setDateRange,
  setCustomDateRange,
  setCalendarUserSearch,
  clearFilters,
  exportToCSV,
  exportToExcel,
  variant = "entries",
  filteredEntriesCount = 0,
  hasActiveFilters = false,
}: AdminReportsFiltersProps) {
  const departmentsWithRoles = allDepartments.filter((dept) => Boolean(dept?.name))

  const isEntriesVariant = variant === "entries"

  if (isEntriesVariant) {
    return (
      <Card className="border-0 bg-linear-to-br from-slate-50 to-blue-50/30 shadow-lg ring-1 ring-slate-200/50 transition-all duration-300 hover:shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                </div>
                <span>Advanced Filters</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                <span className="font-semibold text-blue-600">{filteredEntriesCount}</span>
                <span className="text-muted-foreground"> of </span>
                <span className="font-medium">{entries.length}</span>
                <span className="text-muted-foreground"> entries</span>
                {hasActiveFilters && <span className="ml-2 text-amber-600">• Filters applied</span>}
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    <X className="h-4 w-4" />
                    Clear All
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all active filters</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enhanced Search */}
          <div className="space-y-3">
            <Label htmlFor="search" className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
              <Input
                id="search"
                placeholder="Search by user name, email, department, or professional role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-14 text-base shadow-sm transition-all duration-200 focus:pl-12 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2 transform text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Enhanced Filter Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Filter By</h3>
              <div className="flex items-center gap-2">
                {selectedDepartment !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {departmentsWithRoles.find((d) => d.id === selectedDepartment)?.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedDepartment("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {selectedRole !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    <Briefcase className="h-3 w-3" />
                    {selectedRole}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedRole("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {selectedUser !== "all" && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {filteredUsers.find((u) => u.user_id === selectedUser)?.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedUser("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Enhanced Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="dept-filter" className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Department
                </Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={(value) => {
                    setSelectedDepartment(value)
                    setSelectedRole("all")
                    setSelectedUser("all")
                  }}
                >
                  <SelectTrigger
                    id="dept-filter"
                    className="h-11 min-w-[180px] shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                        <span className="font-semibold">All Departments</span>
                      </div>
                    </SelectItem>
                    {departmentsWithRoles.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enhanced Role Filter */}
              <div className="space-y-2">
                <Label htmlFor="role-filter" className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                  Professional Role
                  {selectedDepartment === "all" && (
                    <span className="ml-2 text-xs font-medium text-amber-600">(select department first)</span>
                  )}
                </Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => {
                    setSelectedRole(value)
                    setSelectedUser("all")
                  }}
                  disabled={selectedDepartment === "all"}
                >
                  <SelectTrigger
                    id="role-filter"
                    className="h-11 min-w-[160px] shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                        <span className="font-semibold">All Professional Roles</span>
                      </div>
                    </SelectItem>
                    {uniqueProfessionalRoles.map((roleName) => (
                      <SelectItem key={roleName} value={roleName}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                          {roleName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enhanced User Filter */}
              <div className="space-y-2">
                <Label htmlFor="user-filter" className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-slate-500" />
                  User
                  {selectedDepartment === "all" && (
                    <span className="ml-2 text-xs font-medium text-amber-600">(select department first)</span>
                  )}
                </Label>
                <Select value={selectedUser} onValueChange={setSelectedUser} disabled={selectedDepartment === "all"}>
                  <SelectTrigger
                    id="user-filter"
                    className="h-11 min-w-[180px] shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <SelectValue
                      placeholder={
                        selectedDepartment === "all"
                          ? "Select department first"
                          : filteredUsers.length === 0
                            ? "No users found"
                            : "All users"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                        <span className="font-semibold">All Users</span>
                      </div>
                    </SelectItem>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enhanced Date Range Filter */}
              <div className="space-y-2">
                <Label htmlFor="date-filter" className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  Date Range
                </Label>
                <Select
                  value={dateRange}
                  onValueChange={(value) => {
                    setDateRange(value)
                    if (value !== "custom") {
                      setCustomDateRange(() => ({ start: "", end: "" }))
                    }
                  }}
                >
                  <SelectTrigger
                    id="date-filter"
                    className="h-11 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                        <span className="font-semibold">All time</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="today">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        Today
                      </div>
                    </SelectItem>
                    <SelectItem value="week">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Last 7 days
                      </div>
                    </SelectItem>
                    <SelectItem value="month">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                        Last 30 days
                      </div>
                    </SelectItem>
                    <SelectItem value="quarter">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                        Last 90 days
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                        Custom range
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {dateRange === "custom" && (
                  <div className="mt-3 space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Select Date Range</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-11 flex-1 justify-start text-left font-normal shadow-sm transition-all duration-200 hover:shadow-md"
                          >
                            <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
                            {customDateRange.start
                              ? format(parseISO(customDateRange.start), "MMM d, yyyy")
                              : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateRange.start ? parseISO(customDateRange.start) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setCustomDateRange((prev: { start: string; end: string }) => ({
                                  ...prev,
                                  start: format(date, "yyyy-MM-dd"),
                                }))
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-11 flex-1 justify-start text-left font-normal shadow-sm transition-all duration-200 hover:shadow-md"
                          >
                            <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
                            {customDateRange.end ? format(parseISO(customDateRange.end), "MMM d, yyyy") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateRange.end ? parseISO(customDateRange.end) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setCustomDateRange((prev: { start: string; end: string }) => ({
                                  ...prev,
                                  end: format(date, "yyyy-MM-dd"),
                                }))
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Export Actions */}
          <div className="space-y-4">
            <Separator className="bg-slate-200" />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Export Data</h3>
                <p className="text-sm text-slate-500">Download filtered results in your preferred format</p>
              </div>
              <div className="flex gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={exportToCSV}
                      variant="outline"
                      size="sm"
                      className="h-11 gap-2 border-green-200 bg-green-50 text-green-700 shadow-sm transition-all duration-200 hover:bg-green-100 hover:shadow-md disabled:opacity-50"
                      disabled={filteredEntriesCount === 0}
                    >
                      <TableIcon className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Export as CSV file</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={exportToExcel}
                      variant="outline"
                      size="sm"
                      className="h-11 gap-2 border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-100 hover:shadow-md disabled:opacity-50"
                      disabled={filteredEntriesCount === 0}
                    >
                      <TableIcon className="h-4 w-4" />
                      Export Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Export as Excel file</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Enhanced Calendar variant
  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="rounded-xl bg-linear-to-br from-slate-50 to-blue-50/30 p-6 shadow-lg ring-1 ring-slate-200/50 transition-all duration-300 hover:shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-3 text-xl font-semibold">
              <div className="rounded-lg bg-blue-100 p-2">
                <Filter className="h-4 w-4 text-blue-600" />
              </div>
              Calendar Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </h2>
            <p className="text-slate-600">
              <span className="font-semibold text-blue-600">{filteredEntriesCount}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="font-medium">{entries.length}</span>
              <span className="text-muted-foreground"> entries</span>
              {hasActiveFilters && <span className="ml-2 text-amber-600">• Filters applied</span>}
            </p>
          </div>
          {hasActiveFilters && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all active filters</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {(selectedDepartment !== "all" || selectedRole !== "all" || selectedUser !== "all" || dateRange !== "all") && (
        <div className="flex flex-wrap gap-2">
          {selectedDepartment !== "all" && (
            <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
              <Building2 className="h-3 w-3" />
              {departmentsWithRoles.find((d) => d.id === selectedDepartment)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setSelectedDepartment("all")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {selectedRole !== "all" && (
            <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 text-purple-700">
              <Briefcase className="h-3 w-3" />
              {selectedRole}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setSelectedRole("all")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {selectedUser !== "all" && (
            <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700">
              <Users className="h-3 w-3" />
              {userOptions.find((u) => u.user_id === selectedUser)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setSelectedUser("all")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {dateRange !== "all" && (
            <Badge variant="outline" className="gap-1 border-orange-200 bg-orange-50 text-orange-700">
              <CalendarDays className="h-3 w-3" />
              {dateRange === "custom" ? "Custom range" : dateRange}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setDateRange("all")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Enhanced Primary Filters Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Enhanced Department Filter */}
        <div className="space-y-2">
          <Label
            htmlFor="cal-dept-filter"
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase"
          >
            <Building2 className="h-4 w-4 text-slate-500" />
            Department
          </Label>
          <Select
            value={selectedDepartment}
            onValueChange={(value) => {
              setSelectedDepartment(value)
              setSelectedRole("all")
              setSelectedUser("all")
            }}
          >
            <SelectTrigger
              id="cal-dept-filter"
              className="h-11 w-full shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
            >
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <span className="font-semibold">All Departments</span>
                </div>
              </SelectItem>
              {departmentsWithRoles.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    {dept.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Enhanced Role Filter */}
        <div className="space-y-2">
          <Label
            htmlFor="cal-role-filter"
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase"
          >
            <Briefcase className="h-4 w-4 text-slate-500" />
            Professional Role
            {selectedDepartment === "all" && (
              <span className="ml-2 text-xs font-normal text-amber-600">(select department first)</span>
            )}
          </Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => {
              setSelectedRole(value)
              setSelectedUser("all")
            }}
            disabled={selectedDepartment === "all"}
          >
            <SelectTrigger
              id="cal-role-filter"
              className="h-11 w-full shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <SelectValue placeholder={selectedDepartment === "all" ? "Select department first" : "All roles"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <span className="font-semibold">All Professional Roles</span>
                </div>
              </SelectItem>
              {uniqueProfessionalRoles.map((roleName) => (
                <SelectItem key={roleName} value={roleName}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    {roleName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Enhanced User Filter */}
        <div className="space-y-2">
          <Label
            htmlFor="cal-user-filter"
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase"
          >
            <Users className="h-4 w-4 text-slate-500" />
            User
            {selectedDepartment === "all" && (
              <span className="ml-2 text-xs font-normal text-amber-600">(select department first)</span>
            )}
          </Label>
          <Select
            value={selectedUser}
            onValueChange={setSelectedUser}
            onOpenChange={(open) => {
              if (!open) setCalendarUserSearch("")
            }}
            disabled={selectedDepartment === "all"}
          >
            <SelectTrigger
              id="cal-user-filter"
              className="h-11 w-full shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <SelectValue
                placeholder={
                  selectedDepartment === "all"
                    ? "Select department first"
                    : userOptions.length === 0
                      ? "No users found"
                      : "All users"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-[360px] overflow-hidden">
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <span className="font-semibold">All Users</span>
                </div>
              </SelectItem>
              {userOptions.length >= 15 && (
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
              ) : (
                <div className={userOptions.length >= 12 ? "max-h-[280px] overflow-y-auto pr-2" : undefined}>
                  {userOptions.map((user, index) => (
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
        </div>

        {/* Enhanced Date Range Filter */}
        <div className="space-y-2">
          <Label
            htmlFor="cal-date-filter"
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase"
          >
            <CalendarDays className="h-4 w-4 text-slate-500" />
            Date Range
          </Label>
          <Select
            value={dateRange}
            onValueChange={(value) => {
              setDateRange(value)
              if (value !== "custom") {
                setCustomDateRange(() => ({ start: "", end: "" }))
              }
            }}
          >
            <SelectTrigger
              id="cal-date-filter"
              className="h-11 w-full shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
            >
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <span className="font-semibold">All time</span>
                </div>
              </SelectItem>
              <SelectItem value="today">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  Today
                </div>
              </SelectItem>
              <SelectItem value="week">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  Last 7 days
                </div>
              </SelectItem>
              <SelectItem value="month">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  Last 30 days
                </div>
              </SelectItem>
              <SelectItem value="quarter">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  Last 90 days
                </div>
              </SelectItem>
              <SelectItem value="custom">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  Custom range
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enhanced Custom Date Range */}
      {dateRange === "custom" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4" />
              Custom Date Range
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 justify-start text-left font-normal shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
                    {customDateRange.start ? format(parseISO(customDateRange.start), "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.start ? parseISO(customDateRange.start) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setCustomDateRange((prev: { start: string; end: string }) => ({
                          ...prev,
                          start: format(date, "yyyy-MM-dd"),
                        }))
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 justify-start text-left font-normal shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
                    {customDateRange.end ? format(parseISO(customDateRange.end), "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.end ? parseISO(customDateRange.end) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setCustomDateRange((prev: { start: string; end: string }) => ({
                          ...prev,
                          end: format(date, "yyyy-MM-dd"),
                        }))
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Action Buttons */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Export Data</h3>
            <p className="text-sm text-slate-500">Download filtered results in your preferred format</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  className="h-11 gap-2 border-green-200 bg-green-50 text-green-700 shadow-sm transition-all duration-200 hover:bg-green-100 hover:shadow-md disabled:opacity-50"
                  disabled={filteredEntriesCount === 0}
                >
                  <TableIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Export as CSV file</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  size="sm"
                  className="h-11 gap-2 border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-100 hover:shadow-md disabled:opacity-50"
                  disabled={filteredEntriesCount === 0}
                >
                  <TableIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Excel</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Export as Excel file</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
