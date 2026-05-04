"use client"

import { useState } from "react"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { UserManagementDialog } from "./user-management-dialog"
import { SupabaseUserManagement } from "./supabase-user-management"
import { CustomQuestionsManager } from "./custom-questions-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Download,
  Upload,
  Trash2,
  Database,
  Activity,
  FileText,
  AlertCircle,
  TrendingUp,
  Users,
  Settings,
} from "lucide-react"
import { toast } from "sonner"

/**
 * Enterprise Admin Dashboard
 * Provides insights, metrics, and administrative controls
 */
export function AdminDashboard({ onClose }: { onClose: () => void }) {
  const { entries, auditLogs, exportData, importData, batchDelete } = useCaptainLog()
  const { canManageUsers, canImportData, canExportData, isAdmin } = useRBAC()
  
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showUserManagement, setShowUserManagement] = useState(false)

  const handleExport = () => {
    try {
      const data = exportData()
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `captain-log-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch {
      toast.error("Failed to export data")
    }
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const text = await file.text()
          await importData(text)
        } catch {
          toast.error("Failed to import data")
        }
      }
    }
    input.click()
  }

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to delete all entries? This cannot be undone.")) {
      try {
        const ids = entries.map((e) => e.id)
        await batchDelete(ids)
      } catch {
        toast.error("Failed to clear data")
      }
    }
  }

  // Calculate metrics
  const totalEntries = entries.length
  const avgVersion = entries.length > 0 ? entries.reduce((sum, e) => sum + (e.version || 1), 0) / entries.length : 0
  const recentAudits = auditLogs.slice(-10).reverse()
  const operationCounts = auditLogs.reduce(
    (acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 overflow-auto rounded-lg border bg-background shadow-lg md:inset-8">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-2xl font-bold">Enterprise Admin Dashboard</h2>
              <p className="text-sm text-muted-foreground">System metrics, audit logs, and data management</p>
            </div>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="flex flex-wrap gap-2 h-auto p-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
              {canManageUsers && (
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              )}
              {canManageUsers && (
                <TabsTrigger value="questions" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Questions
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalEntries}</div>
                    <p className="text-xs text-muted-foreground">Active log entries</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{auditLogs.length}</div>
                    <p className="text-xs text-muted-foreground">Total operations logged</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Versions</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgVersion.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Entry edit history</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Operation Statistics</CardTitle>
                  <CardDescription>Distribution of CRUD operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(operationCounts).map(([op, count]) => (
                      <div key={op} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{op}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Audit Logs</CardTitle>
                  <CardDescription>Last 10 operations with full audit trail</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {recentAudits.map((log) => (
                        <div key={log.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={
                                log.operation === "CREATE"
                                  ? "default"
                                  : log.operation === "UPDATE"
                                    ? "secondary"
                                    : log.operation === "DELETE"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {log.operation}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            <p className="font-mono text-xs text-muted-foreground">Entity ID: {log.entity_id}</p>
                            {log.changes && Object.keys(log.changes).length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-medium">View Changes</summary>
                                <pre className="mt-2 rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(log.changes, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Operations</CardTitle>
                  <CardDescription>Import, export, and manage your data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    {canExportData && (
                      <Button onClick={handleExport} className="flex-1">
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                      </Button>
                    )}
                    {canImportData && (
                      <Button onClick={handleImport} variant="outline" className="flex-1">
                        <Upload className="mr-2 h-4 w-4" />
                        Import Data
                      </Button>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                      <h4 className="mb-2 flex items-center font-semibold text-destructive">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Danger Zone
                      </h4>
                      <p className="mb-4 text-sm text-muted-foreground">
                        Permanently delete all entries. This action cannot be undone.
                      </p>
                      <Button onClick={handleClearAll} variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All Data
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {canManageUsers && (
            <TabsContent value="users" className="space-y-4">
              <SupabaseUserManagement />
            </TabsContent>
          )}
          {canManageUsers && (
            <TabsContent value="questions" className="space-y-4">
              <CustomQuestionsManager />
            </TabsContent>
          )}
          </Tabs>
        </div>
      </div>
      
      {/* User Management Dialog */}
      {showUserManagement && (
        <UserManagementDialog onClose={() => setShowUserManagement(false)} />
      )}
    </div>
  )
}
