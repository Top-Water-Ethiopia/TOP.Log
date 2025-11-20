"use client"

import { useState, useEffect } from "react"
import { CalendarView } from "./calendar-view"
import { EntryFormMultistep } from "./entry-form-multistep"
import { EntryDetails } from "./entry-details"
import { LandingPage } from "./landing-page"
import { ThankYouPage } from "./thank-you-page"
import { ExportDialog } from "./export-dialog"
import { ImportDialog } from "./import-dialog"
import { SearchDialog } from "./search-dialog"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { AdminDashboard } from "./admin-dashboard"
import { SupabaseNav } from "./supabase-nav"
import { Button } from "./ui/button"
import { 
  BarChart3, 
  Shield, 
  ArrowLeft,
  FileText,
  Moon,
  Sun
} from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { VersionInfo } from "./version-info"

export function MainLayoutUpdated() {
  const { entries } = useCaptainLog()
  const { canViewAnalytics, canAccessAdmin, canExportData, canImportData } = useRBAC()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">("landing")
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = entries.find(entry => entry.date === date)
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
      <header className="border-b border-border bg-card flex-shrink-0">
        <div className="max-w-[1300px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div 
              onClick={() => setViewMode("landing")} 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setViewMode("landing")
                }
              }}
            >
              <h1 className="text-3xl font-semibold text-foreground">
                <span className="text-primary">TOP</span> Captain's Log
              </h1>
              <p className="text-sm text-muted-foreground mt-1">IT Department Daily Tracker</p>
            </div>
            <div className="flex gap-2 items-center">
              <SearchDialog onSelectEntry={handleSearchSelect} />
              
              {/* Reports - All authenticated users can view */}
              <Link href="/reports">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Reports
                </Button>
              </Link>
              
              {/* Export/Import - Permission based */}
              {canExportData && <ExportDialog />}
              {canImportData && <ImportDialog />}
              
              {/* Analytics - Permission based */}
              {canViewAnalytics && (
                <Button
                  variant={viewMode === "analytics" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(viewMode === "analytics" ? "calendar" : "analytics")}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Button>
              )}
              
              {/* Admin - Permission based */}
              {canAccessAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdminDashboard(true)}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              )}
              
              {/* Theme Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="gap-2"
                title={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {mounted ? (
                  theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              
              {/* Authentication */}
              <SupabaseNav />
              
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
        {viewMode === "landing" ? (
          <LandingPage
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
            <EntryFormMultistep
              date={editingDate}
              onSave={() => {
                setEditingDate(undefined)
                setViewMode("thankYou")
              }}
              onCancel={() => {
                setEditingDate(undefined)
                setViewMode("landing")
              }}
            />
          </div>
        ) : viewMode === "details" ? (
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

            {/* Right: Entry Details */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <EntryDetails
                date={selectedDate}
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
            </div>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Reports Calendar</h2>
                <p className="text-sm text-muted-foreground mt-1">Select a date to view or create a report</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewMode("landing")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>

            {/* Centered Calendar */}
            <div className="flex-1 flex items-start justify-center overflow-y-auto">
              <div className="w-full max-w-2xl">
                <CalendarView
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
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
