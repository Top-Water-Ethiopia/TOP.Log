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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  Key,
  Bell,
  FileQuestion,
  Settings,
  LogOut,
  Moon,
  Sun,
  FileText,
  PanelLeftIcon,
  type LucideIcon,
} from "lucide-react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { useRBAC } from "@/hooks/use-rbac"

export function AdminSidebar() {
  const pathname = usePathname()
  const { logout, user, profile } = useSupabaseAuth()
  const { hasPermission } = useRBAC()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  useEffect(() => {
    setMounted(true)
  }, [])

  const displayName = profile?.name || user?.email || ""
  const roleLabel = hasPermission("admin.system") ? "Admin" : "User"

  const permissionsEnabled = isFeatureEnabledClient("ADMIN_PERMISSIONS")
  const notificationsEnabled = isFeatureEnabledClient("ADMIN_NOTIFICATIONS")
  const darkModeEnabled = isFeatureEnabledClient("DARK_MODE")

  const canAccessAdmin = hasPermission("admin.system")

  const getInitials = (value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return "?"

    const parts = cleaned.replace(/@.*/, "").split(/\s+/).filter(Boolean)

    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
  }

  // Grouped navigation items
  const userManagementNavItems = [
    {
      name: "Users",
      icon: Users,
      path: "/admin/users",
    },
    {
      name: "Roles",
      icon: Shield,
      path: "/admin/roles",
    },
    ...(permissionsEnabled && canAccessAdmin
      ? [
          {
            name: "Permissions",
            icon: Key,
            path: "/admin/permissions",
          },
        ]
      : []),
  ]

  const contentNavItems = [
    {
      name: "Reports",
      icon: FileText,
      path: "/admin/reports",
    },
    {
      name: "Role Questions",
      icon: FileQuestion,
      path: "/admin/role-questions",
    },
  ]

  const overviewNavItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
      path: "/admin",
    },
    ...(notificationsEnabled
      ? [
          {
            name: "Notifications",
            icon: Bell,
            path: "/admin/notifications",
          },
        ]
      : []),
  ]

  const systemNavItems = [
    {
      name: "Departments",
      icon: Building2,
      path: "/admin/departments",
    },
    // Settings visible on desktop only
    ...(!isMobile
      ? [
          {
            name: "Settings",
            icon: Settings,
            path: "/admin/settings",
          },
        ]
      : []),
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

  type NavItem = {
    name: string
    icon: LucideIcon
    path: string
  }

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon

    // For placeholder items (path === "#"), don't use Link component
    if (item.path === "#") {
      return (
        <SidebarMenuItem key={`${item.name}-${item.path}`}>
          <SidebarMenuButton
            className="w-full cursor-pointer justify-start group-data-[collapsible=icon]:justify-center"
            tooltip={item.name}
          >
            <Icon className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={item.path}>
        <Link href={item.path} className="w-full">
          <SidebarMenuButton
            isActive={isActive(item.path)}
            className="w-full justify-start group-data-[collapsible=icon]:justify-center"
            tooltip={item.name}
          >
            <Icon className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <button
                type="button"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                onClick={() => {
                  if (!isMobile) toggleSidebar()
                }}
                className="bg-primary text-primary-foreground group/logo focus-visible:ring-ring relative flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold outline-none focus-visible:ring-2"
              >
                <span className="transition-opacity duration-150 ease-linear group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0">
                  A
                </span>
                <PanelLeftIcon className="absolute h-4 w-4 opacity-0 transition-opacity duration-150 ease-linear group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100" />
              </button>
            ) : (
              <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
                A
              </div>
            )}
            <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Admin Panel
            </span>
          </div>

          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-6 py-6 group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:py-4">
        <SidebarGroup className="px-4 group-data-[collapsible=icon]:px-2">
          <SidebarMenu>{overviewNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="px-4 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-4 text-xs font-semibold tracking-wider uppercase">
            User Management
          </SidebarGroupLabel>
          <SidebarMenu>{userManagementNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="px-4 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-4 text-xs font-semibold tracking-wider uppercase">
            Content
          </SidebarGroupLabel>
          <SidebarMenu>{contentNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="px-4 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-muted-foreground mb-2 px-4 text-xs font-semibold tracking-wider uppercase">
            System
          </SidebarGroupLabel>
          <SidebarMenu>{systemNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="space-y-2">
        <div className="border-t px-2 pt-2 group-data-[collapsible=icon]:px-1">
          <div className="flex items-center justify-between gap-3 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                {getInitials(displayName)}
              </div>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{displayName || "Signed out"}</span>
                <span className="text-muted-foreground truncate text-xs">{displayName ? roleLabel : ""}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
        {darkModeEnabled ? (
          <Button
            variant="ghost"
            className="w-full justify-start group-data-[collapsible=icon]:justify-center"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted ? (
              theme === "dark" ? (
                <>
                  <Sun className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Toggle Theme</span>
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Toggle Theme</span>
                </>
              )
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                <span className="group-data-[collapsible=icon]:hidden">Toggle Theme</span>
              </>
            )}
          </Button>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
