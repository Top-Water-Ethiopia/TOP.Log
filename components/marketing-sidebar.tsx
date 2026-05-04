"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Users, FileText, ClipboardList, Settings, LineChart } from "lucide-react"

const NAV_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/marketing" },
  { name: "Team", icon: Users, path: "/marketing/team" },
  { name: "Logs", icon: ClipboardList, path: "/marketing/logs" },
  { name: "Reports", icon: FileText, path: "/marketing/reports" },
  { name: "Insights", icon: LineChart, path: "/marketing/insights" },
  { name: "Settings", icon: Settings, path: "/marketing/settings" },
]

export function MarketingSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === "/marketing") return pathname === "/marketing"
    return pathname.startsWith(path)
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Marketing</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.path}>
                  <Link href={item.path} className="w-full">
                    <SidebarMenuButton isActive={isActive(item.path)} className="w-full justify-start" tooltip={item.name}>
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

