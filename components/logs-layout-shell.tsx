"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Shield, FileText, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenuDropdown } from "@/components/user-menu-dropdown"
import { getAvatarLabel, getDisplayLabel } from "@/lib/user-identity"

interface LogsLayoutShellProps {
  children: ReactNode
  isAuthenticated: boolean
  canAccessAdmin: boolean
  canAccessLogs: boolean
  canCreateNewLog: boolean
  logsDisabledReason: string | null
  createDisabledReason: string | null
  viewerContact: string | null
  viewerName: string | null
}

export default function LogsLayoutShell({
  children,
  isAuthenticated,
  canAccessAdmin,
  canAccessLogs,
  canCreateNewLog,
  logsDisabledReason,
  createDisabledReason,
  viewerContact,
  viewerName,
}: LogsLayoutShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const isLogsList = pathname === "/logs"
  const isNewLog = pathname === "/logs/new"
  const shouldShowNewLog = !isNewLog
  const displayLabel = getDisplayLabel({ name: viewerName, viewerContact })
  const avatarLabel = getAvatarLabel(displayLabel)

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/logs" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-muted flex items-center rounded-lg p-1">
                {!isLogsList ? (
                  canAccessLogs ? (
                    <Link href="/logs">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <List className="h-4 w-4" />
                        All Logs
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      disabled
                      title={logsDisabledReason || "Access denied"}
                    >
                      <List className="h-4 w-4" />
                      All Logs
                    </Button>
                  )
                ) : null}
                {shouldShowNewLog ? (
                  canCreateNewLog ? (
                    <Link href="/logs/new">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <FileText className="h-4 w-4" />
                        New Log
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      disabled
                      title={createDisabledReason || "Not available"}
                    >
                      <FileText className="h-4 w-4" />
                      New Log
                    </Button>
                  )
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

              <UserMenuDropdown
                isAuthenticated={isAuthenticated}
                displayLabel={displayLabel}
                avatarLabel={avatarLabel}
                deferUntilMounted
              />
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
