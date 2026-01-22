"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Building2, Shield } from "lucide-react"
import { useSupabaseAuth } from "../../contexts/supabase-auth-context"
import { useRBAC } from "../../hooks/use-rbac"
import { SupabaseNav } from "../../components/supabase-nav"
import { Button } from "../../components/ui/button"

export default function DepartmentsLayout({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth()
  const { canAccessAdmin } = useRBAC()

  const canAccessDepartments = !!user

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {user && canAccessDepartments ? (
                <Link href="/departments">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Departments
                  </Button>
                </Link>
              ) : null}

              {canAccessAdmin ? (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              ) : null}

              <SupabaseNav />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
