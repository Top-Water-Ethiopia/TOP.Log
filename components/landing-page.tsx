"use client"

import { Button } from "./ui/button"
import { FileText, History } from "lucide-react"

interface LandingPageProps {
  canCreateNewReport?: boolean
  newReportDisabledReason?: string
  hasSubmittedReports?: boolean
  onNewReport: () => void
  onViewReports: () => void
}

export function LandingPage({
  canCreateNewReport = true,
  newReportDisabledReason,
  hasSubmittedReports = true,
  onNewReport,
  onViewReports,
}: LandingPageProps) {
  return (
    <div className="h-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center space-y-8">
        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {canCreateNewReport
              ? "What do you want to do?"
              : "View your daily reports"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {canCreateNewReport
              ? "Create a new daily log or browse your existing reports"
              : "Your role is not yet configured with role-specific questions. You can still review your existing reports."}
          </p>
        </div>

        {/* Action Cards */}
        <div
          className={
            hasSubmittedReports
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "grid grid-cols-1 gap-4"
          }
        >
          <div
            onClick={canCreateNewReport ? onNewReport : undefined}
            aria-disabled={!canCreateNewReport}
            className={
              canCreateNewReport
                ? "group cursor-pointer rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent"
                : "rounded-xl border border-border bg-card p-5 shadow-sm opacity-60"
            }
          >
            <div className="flex flex-col items-center text-center h-full">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">New Report</h3>
              {!canCreateNewReport && (
                <p className="text-muted-foreground text-sm">
                  Start a new daily report to log your activities and updates
                </p>
              )}
              {!canCreateNewReport && newReportDisabledReason && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {newReportDisabledReason}
                </p>
              )}
            </div>
          </div>
          
          {hasSubmittedReports && (
            <div 
              onClick={onViewReports}
              className="group cursor-pointer rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent"
            >
              <div className="flex flex-col items-center text-center h-full">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <History className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">View Reports</h3>
                <p className="text-muted-foreground text-sm">
                  Browse and search through your previously submitted reports
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Optional description */}
        <div className="pt-2 text-center text-sm text-muted-foreground">
          Track daily activities. Monitor progress. Review history.
        </div>
      </div>
    </div>
  )
}
