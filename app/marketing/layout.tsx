"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { MarketingSidebar } from "@/components/marketing-sidebar"
import { MarketingDashboardProvider, useMarketingDashboard } from "@/contexts/marketing-dashboard-context"

function MarketingGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSupabaseAuth()
  const { hasPermission, rbacLoading, rbacChecked } = useRBAC()
  const { loading: departmentsLoading, marketingDepartmentId } = useMarketingDashboard()
  const router = useRouter()
  const [canRender, setCanRender] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/login")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (hasPermission("admin.system")) {
      setCanRender(true)
      return
    }

    if (departmentsLoading) return

    // Marketing dashboard is marketing-department-only for now
    if (!marketingDepartmentId) {
      router.replace("/logs")
      return
    }

    setCanRender(true)
  }, [departmentsLoading, hasPermission, isLoading, marketingDepartmentId, rbacChecked, rbacLoading, router, user])

  if (!canRender) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return children
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingDashboardProvider>
      <MarketingGuard>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <MarketingSidebar />
            <SidebarInset className="flex-1 overflow-auto">
              <header className="bg-background sticky top-0 z-10 border-b">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="md:hidden" />
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Back to Home</Link>
                    </Button>
                  </div>
                </div>
              </header>
              <div className="py-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </MarketingGuard>
    </MarketingDashboardProvider>
  )
}

