"use client"

import { useState } from "react"
import { CalendarView } from "./calendar-view"
import { EntryFormMultistep } from "./entry-form-multistep"
import { EntryDetails } from "./entry-details"
import { HistoryView } from "./history-view"
import { ExportDialog } from "./export-dialog"
import { ImportDialog } from "./import-dialog"
import { SearchDialog } from "./search-dialog"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { AdminDashboard } from "./admin-dashboard"
import { Button } from "./ui/button"
import { BarChart3, Shield, History } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { VersionInfo } from "./version-info"

export function MainLayout() {
  const { entries } = useCaptainLog()
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"calendar" | "form" | "details" | "analytics" | "history">("calendar")
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = entries.find(entry => entry.date === date)
    // If entry exists, show details (read mode), otherwise show form (edit mode)
    setViewMode(existingEntry ? "details" : "form")
  }

  const handleSearchSelect = (date: string) => {
    setSelectedDate(date)
    setViewMode("details")
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card flex-shrink-0">
        <div className="max-w-[1300px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                <span className="text-primary">TOP</span> Captain's Log
              </h1>
              <p className="text-sm text-muted-foreground mt-1">IT Department Daily Tracker</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewMode("history")} 
                className="gap-2"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              <SearchDialog onSelectEntry={handleSearchSelect} />
              {/* Hidden for next version */}
              {/* <ExportDialog /> */}
              {/* <ImportDialog /> */}
              {/* <Button
                variant={viewMode === "analytics" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(viewMode === "analytics" ? "calendar" : "analytics")}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Button> */}
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdminDashboard(true)}
                className="gap-2"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Button> */}
              <VersionInfo />
            </div>
          </div>
        </div>
      </header>

      {/* Admin Dashboard Modal */}
      {showAdminDashboard && <AdminDashboard onClose={() => setShowAdminDashboard(false)} />}

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden">
        <div className="max-w-[1300px] mx-auto px-6 py-6 h-full">
        {viewMode === "analytics" ? (
          <div className="h-full overflow-y-auto">
            <AnalyticsDashboard />
          </div>
        ) : viewMode === "history" ? (
          <div className="h-full overflow-y-auto">
            <HistoryView
              onSelectEntry={handleSearchSelect}
              onBack={() => setViewMode("calendar")}
            />
          </div>
        ) : (
          <div className="flex gap-6 h-full">
            {/* Left: Calendar - Fixed width, sticky */}
            <div className="w-[380px] flex-shrink-0">
              <div className="sticky top-0 h-full flex flex-col">
                <CalendarView
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                />
              </div>
            </div>

            {/* Right: Content Area - Flexible width, scrollable */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="h-full flex flex-col">
                {viewMode === "form" && (
                  <EntryFormMultistep
                    date={selectedDate}
                    onSave={() => setViewMode("details")}
                    onCancel={() => setViewMode("calendar")}
                  />
                )}
                {viewMode === "details" && (
                  <EntryDetails
                    date={selectedDate}
                    onEdit={() => setViewMode("form")}
                    onBack={() => setViewMode("calendar")}
                    onViewEntry={(date) => setSelectedDate(date)}
                  />
                )}
                {viewMode === "calendar" && (
                  <div className="bg-card rounded-lg border border-border p-12 text-center flex items-center justify-center h-full min-h-[400px]">
                    <div>
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Select a Date</h3>
                      <p className="text-muted-foreground max-w-md">Choose a date from the calendar to view existing entries or create a new log</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
