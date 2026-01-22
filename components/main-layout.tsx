"use client"

import { useMemo, useState } from "react"
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
import { RoleBasedQuestionsDemo } from "./role-based-questions-demo"
import { AuthDialog } from "./auth-dialog"
import { UserProfileDialog } from "./user-profile-dialog"
import { SupabaseNav } from "./supabase-nav"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { BarChart3, Shield, ArrowLeft, LogOut, User, Settings, FileText } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { canCreateEntryForDate, getToday } from "@/lib/date-restrictions"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { VersionInfo } from "./version-info"
import { ActionMenu, type ActionMenuItem } from "./ui/action-menu"
import { toast } from "sonner"

/**
 * MainLayout - Supabase-first enterprise layout
 * Provides cloud-native authentication and data management
 */
export function MainLayout() {
  const { entries } = useCaptainLog()
  const { isAuthenticated, user, logout } = useAuth()
  const { user: supabaseUser, profile: supabaseProfile } = useSupabaseAuth()
  const { canViewAnalytics, canAccessAdmin, canExportData, canImportData } = useRBAC()
  const isSupabaseLoggedIn = Boolean(supabaseUser)

  const [selectedDate, setSelectedDate] = useState<string>(getToday())
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">(
    "landing"
  )
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

  const departmentId = (supabaseProfile as any)?.department_id as string | undefined
  const entriesForDepartment = useMemo(() => {
    if (!departmentId) return []
    return entries.filter((e: any) => e.department_id === departmentId)
  }, [entries, departmentId])

  const canCreateEntry = isAuthenticated && !!user

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    // Check if entry exists for this date (without creating audit logs)
    const existingEntry = departmentId
      ? entries.find((entry: any) => entry.date === date && entry.department_id === departmentId)
      : undefined
    // If entry exists, show details (read mode), otherwise show form (edit mode)
    if (existingEntry) {
      setViewMode("details")
    } else {
      const createValidation = canCreateEntryForDate(date)
      if (!createValidation.isValid) {
        toast.error(createValidation.error || "This date is locked for new reports")
        setEditingDate(undefined)
        return
      }
      setEditingDate(date)
      setViewMode("form")
    }
  }

  const handleSearchSelect = (date: string) => {
    setSelectedDate(date)
    setViewMode("details")
  }

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "admin":
        return "destructive"
      case "manager":
        return "default"
      case "user":
        return "secondary"
      case "viewer":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-card flex-shrink-0 border-b">
        <div className="mx-auto max-w-[1300px] px-6 py-6">
          <div className="flex items-center justify-between">
            <div
              onClick={() => setViewMode("landing")}
              className="cursor-pointer transition-opacity duration-150 ease-in-out hover:opacity-80"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setViewMode("landing")
                }
              }}
            >
              <h1 className="text-foreground text-3xl font-semibold">
                <span className="text-primary">TOP</span> Captain's Log
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">IT Department Daily Tracker</p>
            </div>
            <div className="flex gap-2">
              {/* Primary Navigation - Left side */}
              <div className="flex gap-2">
                {isFeatureEnabledClient("SEARCH") ? (
                  <SearchDialog onSelectEntry={handleSearchSelect} entries={entriesForDepartment} />
                ) : null}

                {/* Admin */}
                {canAccessAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowAdminDashboard(true)} className="gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                    <Link href="/admin/reports">
                      <Button variant="outline" size="sm" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Reports
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {/* Utility Items - Right side */}
              <div className="ml-auto flex gap-2">
                {/* Authentication */}
                {isSupabaseLoggedIn ? (
                  <SupabaseNav />
                ) : isAuthenticated && user ? (
                  <ActionMenu
                    align="end"
                    contentClassName="w-56"
                    trigger={
                      <Button variant="outline" size="sm" className="gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="text-xs">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {user.name.split(" ")[0]}
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                          {user.role}
                        </Badge>
                      </Button>
                    }
                    items={
                      [
                        {
                          type: "label",
                          label: (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>
                                  {user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-muted-foreground text-sm">{user.email}</div>
                              </div>
                            </div>
                          ),
                        },
                        { type: "separator" },
                        {
                          type: "item",
                          label: "Profile",
                          icon: <User className="mr-2 h-4 w-4" />,
                          onSelect: () => setShowProfileDialog(true),
                        },
                        {
                          type: "item",
                          label: "Settings",
                          icon: <Settings className="mr-2 h-4 w-4" />,
                          onSelect: () => setShowProfileDialog(true),
                        },
                        { type: "separator" },
                        {
                          type: "item",
                          label: "Logout",
                          icon: <LogOut className="mr-2 h-4 w-4" />,
                          destructive: true,
                          onSelect: logout,
                        },
                      ] satisfies ActionMenuItem[]
                    }
                  />
                ) : (
                  <>
                    {/* Supabase Auth Nav */}
                    <SupabaseNav />
                  </>
                )}

                <VersionInfo />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Dashboard Modal */}
      {showAdminDashboard && <AdminDashboard onClose={() => setShowAdminDashboard(false)} />}

      {/* Auth Dialog */}
      {showAuthDialog && <AuthDialog onClose={() => setShowAuthDialog(false)} />}

      {/* Profile Dialog */}
      {showProfileDialog && <UserProfileDialog onClose={() => setShowProfileDialog(false)} />}

      {/* Main Content */}
      <main className="w-full flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-[1300px] px-6 py-6">
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
              {departmentId && (
                <EntryFormMultistep
                  departmentId={departmentId}
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
              )}
            </div>
          ) : viewMode === "details" ? (
            <div className="flex h-full gap-6">
              {/* Left: Calendar - Fixed width, sticky */}
              <div className="w-[380px] flex-shrink-0">
                <div className="sticky top-0 flex h-full flex-col">
                  <CalendarView
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    entries={entriesForDepartment}
                  />
                </div>
              </div>

              {/* Right: Entry Details */}
              <div className="min-w-0 flex-1 overflow-y-auto">
                {departmentId && (
                  <EntryDetails
                    date={selectedDate}
                    departmentId={departmentId}
                    onBack={() => setViewMode("calendar")}
                    onViewEntry={(date) => {
                      setSelectedDate(date)
                      setViewMode("details")
                    }}
                  />
                )}
              </div>
            </div>
          ) : viewMode === "calendar" ? (
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-foreground text-2xl font-semibold">Reports Calendar</h2>
                  <p className="text-muted-foreground mt-1 text-sm">Select a date to view or create a report</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewMode("landing")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>

              {/* Centered Calendar */}
              <div className="flex flex-1 items-start justify-center overflow-y-auto">
                <div className="w-full max-w-2xl">
                  <CalendarView
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    entries={entriesForDepartment}
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
