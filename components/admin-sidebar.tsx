"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  FileQuestion,
  Settings,
  LogOut,
  Moon,
  Sun,
  FileText,
} from "lucide-react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useIsMobile } from "@/hooks/use-mobile"

export function AdminSidebar() {
  const pathname = usePathname()
  const { logout, user, profile } = useSupabaseAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  const displayName = profile?.name || user?.email || ""
  const roleLabel = profile?.role_id === "00000000-0000-0000-0000-000000000001" ? "Admin" : "User"

  const getInitials = (value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return "?"

    const parts = cleaned.replace(/@.*/, "").split(/\s+/).filter(Boolean)

    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
  }

  // Main navigation items - organized by category
  const mainNavItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
      path: "/admin",
    },
    {
      name: "Users",
      icon: Users,
      path: "/admin/users",
    },
    {
      name: "Departments",
      icon: Building2,
      path: "/admin/departments",
    },
    {
      name: "Roles",
      icon: Shield,
      path: "/admin/roles",
    },
  ]

  const reportsNavItems = [
    {
      name: "Reports",
      icon: FileText,
      path: "/admin/reports",
    },
  ]

  // Questions configuration items
  const questionsNavItems = [
    {
      name: "Role Questions",
      icon: FileQuestion,
      path: "/admin/role-questions",
    },
  ]

  // Settings - hidden on mobile
  const settingsNavItems = [
    {
      name: "Settings",
      icon: Settings,
      path: "/admin/settings",
    },
  ]

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin"
    }
    return pathname.startsWith(path)
  }

  const renderNavItem = (item: { name: string; icon: any; path: string }) => {
    const Icon = item.icon

    // For placeholder items (path === "#"), don't use Link component
    if (item.path === "#") {
      return (
        <SidebarMenuItem key={`${item.name}-${item.path}`}>
          <SidebarMenuButton className="w-full cursor-pointer justify-start">
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={item.path}>
        <Link href={item.path} className="w-full">
          <SidebarMenuButton isActive={isActive(item.path)} className="w-full justify-start">
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
            A
          </div>
          <span className="text-lg font-semibold tracking-tight">Admin Panel</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-6 py-6">
        {/* Reports */}
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
            Reports
          </SidebarGroupLabel>
          <SidebarMenu>{reportsNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
            Management
          </SidebarGroupLabel>
          <SidebarMenu>{mainNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        {/* Questions Configuration */}
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
            Questions
          </SidebarGroupLabel>
          <SidebarMenu>{questionsNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        {/* Settings - hidden on mobile */}
        {!isMobile && (
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
              Configuration
            </SidebarGroupLabel>
            <SidebarMenu>{settingsNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted ? (
            theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4" />
                <span>Toggle Theme</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" />
                <span>Toggle Theme</span>
              </>
            )
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              <span>Toggle Theme</span>
            </>
          )}
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </Button>
        <div className="border-t pt-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
              {getInitials(displayName)}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{displayName || "Signed out"}</span>
              <span className="text-muted-foreground truncate text-xs">{displayName ? roleLabel : ""}</span>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
