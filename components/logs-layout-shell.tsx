"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Shield, ChevronDown, FileText, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface LogsLayoutShellProps {
  children: ReactNode
  canAccessAdmin: boolean
  canCreateNewLog: boolean
  viewerEmail: string | null
  viewerName: string | null
}

export default function LogsLayoutShell({
  children,
  canAccessAdmin,
  canCreateNewLog,
  viewerEmail,
  viewerName,
}: LogsLayoutShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isLogsList = pathname === "/logs"
  const isNewLog = pathname === "/logs/new"
  const shouldShowNewLog = canCreateNewLog && !isNewLog
  const displayName = viewerName || viewerEmail || "User"
  const avatarLabel = displayName.charAt(0).toUpperCase() || "U"

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-muted flex items-center rounded-lg p-1">
                {!isLogsList ? (
                  <Link href="/logs">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <List className="h-4 w-4" />
                      All Logs
                    </Button>
                  </Link>
                ) : null}
                {shouldShowNewLog ? (
                  <Link href="/logs/new">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      New Log
                    </Button>
                  </Link>
                ) : null}
              </div>

              {canAccessAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}

              {viewerEmail && isMounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100">
                      <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
                        <span className="text-sm font-medium text-white">{avatarLabel}</span>
                      </div>
                      <span className="text-sm font-medium text-zinc-900">{displayName}</span>
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={async () => {
                        const { supabase } = await import("@/lib/supabase/client")
                        await supabase.auth.signOut()
                        router.push("/login")
                      }}
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 overflow-auto">
        <div className="mx-auto h-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
