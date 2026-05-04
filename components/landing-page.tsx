"use client"

import { Button } from "./ui/button"
import Link from "next/link"
import { FileText, History, Lock } from "lucide-react"

interface LandingPageProps {
  isAuthenticated?: boolean
  canCreateNewReport?: boolean
  newReportDisabledReason?: string
  hasSubmittedReports?: boolean
  hasReportsForAllAllowedDates?: boolean
  onRequestAccess?: () => void
  isRequestingAccess?: boolean
  onNewReport: () => void
  onViewReports: () => void
}

export function LandingPage({
  isAuthenticated = true,
  canCreateNewReport = true,
  newReportDisabledReason,
  hasSubmittedReports = true,
  onRequestAccess,
  isRequestingAccess = false,
  onNewReport,
  onViewReports,
}: LandingPageProps) {
  if (!isAuthenticated) {
    return (
      <div className="h-full">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-foreground text-2xl font-semibold tracking-tight">You're signed out</h2>
            <p className="text-muted-foreground text-sm">Log in to create and view daily reports.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
              <div className="flex h-full flex-col items-center text-center">
                <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">Login</h3>
                <div className="mt-4">
                  <Button size="sm" asChild>
                    <Link href="/login">Go to Login</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground pt-2 text-center text-sm">
            Track daily activities. Monitor progress. Review history.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center space-y-8">
        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            {canCreateNewReport ? "What do you want to do?" : "View your daily reports"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {canCreateNewReport
              ? "Create a new daily log or browse your existing reports"
              : "Your role is not yet configured with role-specific questions. You can still review your existing reports."}
          </p>
        </div>

        {/* Action Cards */}
        <div className={hasSubmittedReports ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4"}>
          <div
            onClick={canCreateNewReport ? onNewReport : undefined}
            onKeyDown={(e) => {
              if (!canCreateNewReport) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onNewReport()
              }
            }}
            role={canCreateNewReport ? "button" : undefined}
            tabIndex={canCreateNewReport ? 0 : -1}
            aria-disabled={!canCreateNewReport}
            className={
              canCreateNewReport
                ? "group border-border bg-card hover:border-ring/40 focus-visible:ring-ring/50 cursor-pointer rounded-xl border p-6 shadow-sm transition-[box-shadow,border-color] duration-150 ease-in-out hover:shadow-md focus-visible:ring-[3px] focus-visible:outline-none"
                : onRequestAccess
                  ? "border-border bg-card rounded-xl border p-6 shadow-sm"
                  : "border-border bg-card rounded-xl border p-6 opacity-60 shadow-sm"
            }
          >
            <div className="flex h-full flex-col items-center text-center">
              <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">New Report</h3>

              {!canCreateNewReport && newReportDisabledReason && (
                <p className="text-muted-foreground mt-2 text-xs">{newReportDisabledReason}</p>
              )}
              {!canCreateNewReport && onRequestAccess && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRequestingAccess}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onRequestAccess()
                    }}
                  >
                    Request Access
                  </Button>
                </div>
              )}
            </div>
          </div>

          {hasSubmittedReports && (
            <div
              onClick={onViewReports}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onViewReports()
                }
              }}
              role="button"
              tabIndex={0}
              className="group border-border bg-card hover:border-ring/40 focus-visible:ring-ring/50 cursor-pointer rounded-xl border p-6 shadow-sm transition-[box-shadow,border-color] duration-150 ease-in-out hover:shadow-md focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <div className="flex h-full flex-col items-center text-center">
                <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <History className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">View Reports</h3>
              </div>
            </div>
          )}
        </div>

        {/* Optional description */}
        <div className="text-muted-foreground pt-2 text-center text-sm">
          Track daily activities. Monitor progress. Review history.
        </div>
      </div>
    </div>
  )
}
