"use client"

import { Button } from "./ui/button"
import { CheckCircle2, FileText, Calendar, Home, Sparkles, ArrowRight } from "lucide-react"
import { Badge } from "./ui/badge"

interface ThankYouPageProps {
  onNewReport: () => void
  onViewReports: () => void
  onBackHome: () => void
  hasReportsForAllAllowedDates?: boolean
  completedDates?: string[]
  missingDates?: string[]
  hoursUntilNextAvailable?: number
}

export function ThankYouPage({
  onNewReport,
  onViewReports,
  onBackHome,
  hasReportsForAllAllowedDates = false,
  completedDates = [],
  missingDates = [],
  hoursUntilNextAvailable = 24,
}: ThankYouPageProps) {
  const completedCount = completedDates.length
  const missingCount = missingDates.length
  const progressText = hasReportsForAllAllowedDates
    ? `🔥 ${completedCount}-day streak complete!`
    : `${missingCount} more ${missingCount === 1 ? "entry" : "entries"} to go`

  return (
    <div className="bg-background relative flex h-full items-center justify-center overflow-hidden">
      {/* Premium Decorative Elements */}
      <div className="pointer-events-none absolute top-0 left-0 h-full w-full overflow-hidden">
        <div className="bg-primary/5 absolute top-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]" />
        <div className="bg-accent/5 absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-2xl space-y-12 px-6 text-center">
        {/* Success Icon Section */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Multi-layered glow effect */}
            <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/20 blur-2xl" />
            <div className="bg-card relative flex h-32 w-32 items-center justify-center rounded-full border border-green-500/20 shadow-[0_0_50px_-12px_rgba(34,197,94,0.25)] dark:shadow-[0_0_50px_-12px_rgba(34,197,94,0.15)]">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-500" strokeWidth={1.5} />
              </div>
            </div>
            {/* Floating sparkle icons */}
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 animate-bounce text-amber-400" />
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-foreground text-4xl font-extrabold tracking-tight sm:text-5xl">
              {hasReportsForAllAllowedDates ? "All Caught Up!" : "Thank You!"}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-md text-lg leading-relaxed font-medium">
              {hasReportsForAllAllowedDates
                ? "You've successfully tracked all activities for the last 3 days. Your record is fully up to date."
                : "Your daily report has been successfully processed and securely stored in the system."}
            </p>
          </div>

          {/* Progress Indicator - Always show */}
          <div className="flex justify-center pt-2">
            <Badge
              variant="outline"
              className={`gap-2 rounded-full px-4 py-1.5 font-semibold ${
                hasReportsForAllAllowedDates
                  ? "border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400"
                  : "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${hasReportsForAllAllowedDates ? "bg-green-500" : "bg-amber-500"}`}
              />
              {progressText}
            </Badge>
          </div>

          {/* Missing Dates Info */}
          {!hasReportsForAllAllowedDates && missingDates.length > 0 && (
            <div className="mx-auto max-w-md rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">You still need to log:</p>
              <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {missingDates.map((date) => (
                  <li key={date} className="flex items-center gap-2">
                    <span className="text-amber-500">•</span>
                    {date === new Date().toISOString().split("T")[0]
                      ? "Today"
                      : date === new Date(Date.now() - 86400000).toISOString().split("T")[0]
                        ? "Yesterday"
                        : date}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next available info when complete */}
          {hasReportsForAllAllowedDates && (
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              Next entry available in {hoursUntilNextAvailable} hours (tomorrow at midnight)
            </p>
          )}
        </div>

        {/* Action Section */}
        <div className="space-y-8">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {!hasReportsForAllAllowedDates && (
              <Button
                onClick={onNewReport}
                size="lg"
                className="h-14 w-full gap-2 rounded-2xl px-10 font-semibold shadow-lg transition-all sm:w-auto"
              >
                <FileText className="h-5 w-5" />
                Create New Entry
              </Button>
            )}

            <Button
              onClick={onViewReports}
              variant={hasReportsForAllAllowedDates ? "default" : "outline"}
              size="lg"
              className={`h-14 w-full gap-2 rounded-2xl font-semibold transition-all sm:w-auto ${
                hasReportsForAllAllowedDates ? "px-10 shadow-lg" : "px-10"
              }`}
            >
              <Calendar className="h-5 w-5" />
              {hasReportsForAllAllowedDates ? "Review Your Logs" : "Historical Records"}
            </Button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={onBackHome}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-2 text-sm font-semibold transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Navigate Dashboard</span>
              <ArrowRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Footer info line */}
        <div className="border-border border-t pt-8">
          <p className="text-muted-foreground text-xs font-bold tracking-[0.2em] uppercase">
            Data Integrity & Compliance Certified
          </p>
        </div>
      </div>
    </div>
  )
}
