"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Button } from "@/components/ui/button"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Menu,
  Home,
  Calendar,
  BarChart3,
  FileText,
  Shield,
  User,
  LogOut,
  Settings,
  LayoutDashboard,
  Building2,
  FileQuestion,
} from "lucide-react"

export function MobileNavigation() {
  const pathname = usePathname()
  const { user, profile, logout } = useSupabaseAuth()
  const { canAccessAdmin, canViewAnalytics } = useRBAC()
  const [isOpen, setIsOpen] = useState(false)

  const profileEnabled = isFeatureEnabledClient("PROFILE")
  const roleAndAccessEnabled = isFeatureEnabledClient("ADMIN_ROLE_AND_ACCESS")

  // Handle logout
  const handleLogout = async () => {
    try {
      setIsOpen(false)
      await logout()
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  // Navigation items (placeholders)
  const navItems = [
    {
      name: "Home",
      href: "#",
      icon: Home,
      active: pathname === "/",
    },
    {
      name: "Calendar",
      href: "#",
      icon: Calendar,
      active: pathname.startsWith("/calendar"),
    },
    {
      name: "Analytics",
      href: "#",
      icon: BarChart3,
      active: pathname.startsWith("/analytics"),
    },
  ]

  // Admin items - Main navigation
  const adminMainItems = [
    {
      name: "Overview",
      href: "/admin",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      name: "Users",
      href: "/admin/users",
      icon: User,
      active: pathname.startsWith("/admin/users"),
    },
    {
      name: "Departments",
      href: "/admin/departments",
      icon: Building2,
      active: pathname.startsWith("/admin/departments"),
    },
    {
      name: roleAndAccessEnabled ? "Role and Access" : "Role and Access (Future)",
      href: roleAndAccessEnabled ? "/admin/role-and-access" : "#",
      icon: Shield,
      active: roleAndAccessEnabled && pathname.startsWith("/admin/role-and-access"),
      disabled: !roleAndAccessEnabled,
    },
  ]

  const adminReportsItems = [
    {
      name: "Reports",
      href: "/admin/reports",
      icon: FileText,
      active: pathname.startsWith("/admin/reports"),
    },
  ]

  // Admin items - Questions configuration
  const adminQuestionsItems = [
    {
      name: "Questions",
      href: "/admin/questions",
      icon: FileQuestion,
      active: pathname.startsWith("/admin/questions"),
    },
  ]

  // Admin items - Settings
  const adminSettingsItems = [
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Settings,
      active: pathname.startsWith("/admin/settings"),
    },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">TOP Captain's Log</h2>
            {user ? (
              <p className="text-muted-foreground truncate text-sm">{profile?.name || user.email}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Guest</p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {false && (
              <div className="space-y-2 px-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                      item.active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Admin Section - Only shown when user is logged in */}
            {user && canAccessAdmin && (
              <div className="px-2 pt-4">
                <h3 className="text-muted-foreground px-4 text-xs font-semibold tracking-wider uppercase">Reports</h3>
                <div className="space-y-1 pt-2">
                  {adminReportsItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </div>

                <h3 className="text-muted-foreground px-4 text-xs font-semibold tracking-wider uppercase">
                  Management
                </h3>
                <div className="space-y-1 pt-2">
                  {adminMainItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={(event) => {
                        if (item.disabled) {
                          event.preventDefault()
                          return
                        }
                        setIsOpen(false)
                      }}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : item.disabled
                            ? "text-muted-foreground cursor-not-allowed opacity-60"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </div>

                <h3 className="text-muted-foreground px-4 pt-4 text-xs font-semibold tracking-wider uppercase">
                  Questions
                </h3>
                <div className="space-y-1 pt-2">
                  {adminQuestionsItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </div>

                <h3 className="text-muted-foreground px-4 pt-4 text-xs font-semibold tracking-wider uppercase">
                  Configuration
                </h3>
                <div className="space-y-1 pt-2">
                  {adminSettingsItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Analytics Section - Only shown when user is logged in */}
            {user && canViewAnalytics && (
              <div className="px-2 pt-4">
                <Link
                  href="#"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out ${
                    pathname.startsWith("/analytics")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="space-y-2">
              {user ? (
                <>
                  {/* Hide Profile and Settings for admin users */}
                  {!canAccessAdmin && (
                    <>
                      {profileEnabled ? (
                        <Link
                          href="/profile"
                          onClick={() => setIsOpen(false)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out"
                        >
                          <User className="h-4 w-4" />
                          Profile
                        </Link>
                      ) : null}
                      <Link
                        href="/settings"
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground w-full justify-start gap-2 px-4 py-2 text-sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out"
                  >
                    <User className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors duration-150 ease-in-out"
                  >
                    <Settings className="h-4 w-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
