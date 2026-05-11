"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Users, ClipboardList, Settings, LineChart } from "lucide-react"

const NAV_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/marketing" },
  { name: "Logs", icon: ClipboardList, path: "/marketing/logs" },
  { name: "Team", icon: Users, path: "/marketing/team" },
  { name: "Agents", icon: Users, path: "/marketing/agents", gated: true },
  { name: "Insights", icon: LineChart, path: "/marketing/insights" },
  { name: "Setting", icon: Settings, path: "/marketing/settings" },
]

export function MarketingSidebar() {
  const pathname = usePathname()
  const [canManageAgents, setCanManageAgents] = useState<boolean>(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await fetch("/api/marketing/agents/can-manage", { method: "GET" })
        if (!mounted) return
        setCanManageAgents(res.ok)
      } catch {
        if (!mounted) return
        setCanManageAgents(false)
      } finally {
        if (!mounted) return
        setLoaded(true)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [])

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
            {NAV_ITEMS.filter((item: any) => !item.gated || (loaded && canManageAgents)).map((item: any) => {
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
