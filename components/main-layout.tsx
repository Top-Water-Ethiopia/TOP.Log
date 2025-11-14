"use client"

import { useState } from "react"
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
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { 
  BarChart3, 
  Shield, 
  ArrowLeft, 
  LogIn, 
  LogOut, 
  User, 
  Settings,
  Lock
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { VersionInfo } from "./version-info"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function MainLayout() {
  const { entries } = useCaptainLog()
  const { isAuthenticated, user, logout } = useAuth()
  const { canViewAnalytics, canAccessAdmin, canExportData, canImportData } = useRBAC()
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"landing" | "calendar" | "form" | "details" | "analytics" | "thankYou">("landing")
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [editingDate, setEditingDate] = useState<string | undefined>(undefined)

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

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "admin": return "destructive"
      case "manager": return "default"
      case "user": return "secondary"
      case "viewer": return "outline"
      default: return "outline"
    }
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
            <div className="flex gap-2">
              <SearchDialog onSelectEntry={handleSearchSelect} />
              
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
              
              {/* Authentication */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="text-xs">
                          {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.name.split(" ")[0]}
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                        {user.role}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>
                          {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuthDialog(true)}
                  className="gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </Button>
              )}
              
              <VersionInfo />
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
