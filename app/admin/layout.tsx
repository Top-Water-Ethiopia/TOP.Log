"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Button } from "@/components/ui/button"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, profile, logout } = useSupabaseAuth()

  const displayName = profile?.name || user?.email || ""

  const getInitials = (value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return "?"

    const parts = cleaned.replace(/@.*/, "").split(/\s+/).filter(Boolean)

    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
  }

  const handleLogout = () => {
    logout().catch((error) => {
      console.error("Logout error:", error)
    })
  }

  const actionMenuItems: ActionMenuItem[] = [
    {
      type: "item",
      label: "Log out",
      icon: <LogOutIcon className="mr-2 h-4 w-4" />,
      onSelect: handleLogout,
    },
  ]

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <SidebarInset className="flex-1 overflow-auto">
          <header className="bg-background sticky top-0 z-10 border-b">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <Button asChild variant="outline" size="sm">
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>

              {user ? (
                <ActionMenu
                  align="end"
                  contentClassName="w-56"
                  items={actionMenuItems}
                  trigger={
                    <button
                      type="button"
                      className="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2 py-1 text-left"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:block">
                        <div className="text-sm leading-none font-medium">{displayName}</div>
                        <div className="text-muted-foreground text-xs leading-none">{user.email}</div>
                      </div>
                      <ChevronDownIcon className="text-muted-foreground h-4 w-4" />
                    </button>
                  }
                />
              ) : null}
            </div>
          </header>
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
