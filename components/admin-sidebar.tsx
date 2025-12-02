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
  SidebarFooter
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
  FileText
} from "lucide-react"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"

export function AdminSidebar() {
  const pathname = usePathname()
  const { logout } = useSupabaseAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Main navigation items - organized by category
  const mainNavItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
      path: "/admin"
    },
    {
      name: "Reports",
      icon: FileText,
      path: "/admin/reports"
    },
    {
      name: "Users",
      icon: Users,
      path: "/admin/users"
    },
    {
      name: "Departments",
      icon: Building2,
      path: "/admin/departments"
    },
    {
      name: "Roles",
      icon: Shield,
      path: "/admin/roles"
    }
  ]

  // Questions configuration items
  const questionsNavItems = [
    {
      name: "Role Questions",
      icon: FileQuestion,
      path: "/admin/role-questions"
    }
  ]

  // Settings
  const settingsNavItems = [
    {
      name: "Settings",
      icon: Settings,
      path: "/admin/settings"
    }
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
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {mainNavItems.map(renderNavItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* Questions Configuration */}
        <SidebarGroup>
          <SidebarGroupLabel>Questions</SidebarGroupLabel>
          <SidebarMenu>
            {questionsNavItems.map(renderNavItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarMenu>
            {settingsNavItems.map(renderNavItem)}
          </SidebarMenu>
        </SidebarGroup>
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
                <Sun className="h-4 w-4 mr-2" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 mr-2" />
                <span>Dark Mode</span>
              </>
            )
          ) : (
            <>
              <Moon className="h-4 w-4 mr-2" />
              <span>Theme</span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
