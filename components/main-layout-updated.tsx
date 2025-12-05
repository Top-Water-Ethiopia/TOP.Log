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
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { VersionInfo } from "./version-info"
import { useRouter } from "next/navigation"

// Role IDs from schema
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';

interface MainLayoutUpdatedProps {
	initialRoleQuestions: any[];
}

export function MainLayoutUpdated({ initialRoleQuestions }: MainLayoutUpdatedProps) {
  const { entries } = useCaptainLog()
  const { canViewAnalytics, canAccessAdmin, canExportData, canImportData } = useRBAC()
  const { profile } = useSupabaseAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  
  // Check if current user is super admin
  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID;
  
  // Redirect superadmin without department to admin page
  useEffect(() => {
    if (isSuperAdmin && (!profile?.department || profile?.department === '')) {
      router.push('/admin')
    }
  }, [isSuperAdmin, profile?.department, router])
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">("landing")
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

  const hasRoleQuestions = initialRoleQuestions && initialRoleQuestions.length > 0

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
              {/* Primary Navigation - Left side */}
              <div className="flex gap-2">
                <SearchDialog onSelectEntry={handleSearchSelect} />
                
                {/* Admin - Permission based or Super Admin */}
                {(canAccessAdmin || isSuperAdmin) && (
                  <>
                    <Link href="/admin">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                    <Link href="/admin/reports">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Reports
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              
              {/* Utility Items - Right side */}
              <div className="flex gap-2 ml-auto">
                {/* Authentication */}
                <SupabaseNav />
                
                <VersionInfo />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden">
        <div className="max-w-[1300px] mx-auto px-6 py-6 h-full">
        {viewMode === "landing" ? (
          <LandingPage
            canCreateNewReport={hasRoleQuestions}
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