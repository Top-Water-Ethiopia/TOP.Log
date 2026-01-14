"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Eye,
  FileText,
  TrendingDown,
  TrendingUp,
  Users,
  TableIcon,
} from "lucide-react"

export interface DashboardStats {
  totalEntries: number
  totalUsers: number
  entriesThisWeek: number
  entriesThisMonth: number
  avgResponsesPerEntry: number
  mostActiveUsers: Array<{ name: string; count: number }>
  entryTrend: "up" | "down" | "stable"
}

export interface AdminReportsDashboardTabProps {
  stats: DashboardStats
  onExportCsv: () => void
  onViewEntries: () => void
}

/**
 * Renders the admin "Dashboard" view for reports.
 *
 * Why this exists: the main reports view is already large and mixes data orchestration
 * (fetching, filtering, pagination) with purely presentational layout.
 * Extracting the dashboard keeps the core orchestration easier to reason about and
 * makes future dashboard iterations less risky.
 */
export function AdminReportsDashboardTab({ stats, onExportCsv, onViewEntries }: AdminReportsDashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Total Entries</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries}</div>
            <p className="text-muted-foreground mt-2 text-xs">From {stats.totalUsers} users</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">This Week</CardTitle>
            <CalendarDays className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.entriesThisWeek}</div>
            <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
              {stats.entryTrend === "up" && (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Increasing</span>
                </>
              )}
              {stats.entryTrend === "down" && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">Decreasing</span>
                </>
              )}
              {stats.entryTrend === "stable" && <span>Stable trend</span>}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">This Month</CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.entriesThisMonth}</div>
            <p className="text-muted-foreground mt-2 text-xs">Last 30 days</p>
          </CardContent>
        </Card>

        {/* <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Avg Responses</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponsesPerEntry.toFixed(1)}</div>
            <p className="text-muted-foreground mt-2 text-xs">Per entry</p>
          </CardContent>
        </Card> */}
      </div>

      {/* Most Active Users */}
      <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="text-muted-foreground h-5 w-5" />
            <span className="text-muted-foreground">Most Active Contributors</span>
          </CardTitle>
          <CardDescription>Top users by number of entries submitted</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.mostActiveUsers.length > 0 ? (
            <div className="space-y-4">
              {stats.mostActiveUsers.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {index + 1}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <Badge variant="secondary">{user.count} entries</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">No data available</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Quick Actions</CardTitle>
          <CardDescription>Export and analyze data</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button onClick={onExportCsv} variant="outline" className="gap-2">
            <TableIcon className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={onViewEntries} variant="default" className="gap-2">
            <Eye className="h-4 w-4" />
            View All Entries
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
