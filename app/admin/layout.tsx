"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Button } from "@/components/ui/button"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth()
  const { canAccessAdmin, rbacLoading } = useRBAC()
  const [headerMode, setHeaderMode] = useState<"checking" | "show" | "hide">("checking")

  useEffect(() => {
    if (!user || rbacLoading) {
      setHeaderMode("checking")
      return
    }

    if (!canAccessAdmin) {
      setHeaderMode("show")
      return
    }

    if (headerMode !== "checking") return

    const run = async () => {
      try {
        const res = await fetch("/api/departments")
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setHeaderMode("hide")
          return
        }
        const rows = Array.isArray(json.data) ? json.data : []
        setHeaderMode(rows.length === 0 ? "hide" : "show")
      } catch {
        setHeaderMode("hide")
      }
    }

    run()
  }, [user, rbacLoading, canAccessAdmin, headerMode])

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <SidebarInset className="flex-1 overflow-auto">
          {headerMode === "hide" ? null : (
            <header
              className={"bg-background sticky top-0 z-10 border-b" + (headerMode === "checking" ? " invisible" : "")}
            >
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <Button asChild variant="outline" size="sm">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              </div>
            </header>
          )}
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
