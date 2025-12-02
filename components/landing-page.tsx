"use client"

import { Button } from "./ui/button"
import { FileText, History } from "lucide-react"

interface LandingPageProps {
  canCreateNewReport?: boolean
  onNewReport: () => void
  onViewReports: () => void
}

export function LandingPage({ canCreateNewReport = true, onNewReport, onViewReports }: LandingPageProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-2xl w-full text-center space-y-12 px-6">
        {/* Heading */}
        <div className="space-y-4">
          <h2 className="text-5xl font-bold text-foreground tracking-tight">
            {canCreateNewReport
              ? "What do you want to do?"
              : "View your daily reports"}
          </h2>
          <p className="text-lg text-muted-foreground">
            {canCreateNewReport
              ? "Create a new daily log or browse your existing reports"
              : "Your role is not yet configured with role-specific questions. You can still review your existing reports."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          {canCreateNewReport && (
            <Button
              onClick={onNewReport}
              size="lg"
              className="w-full sm:w-64 h-32 text-xl font-semibold flex flex-col gap-4 hover:scale-105 transition-transform"
            >
              <FileText className="h-12 w-12" />
              New Report
            </Button>
          )}
          <Button
            onClick={onViewReports}
            variant="outline"
            size="lg"
            className="w-full sm:w-64 h-32 text-xl font-semibold flex flex-col gap-4 hover:scale-105 transition-transform"
          >
            <History className="h-12 w-12" />
            View Reports
          </Button>
        </div>

        {/* Optional description */}
        <div className="pt-8 space-y-2">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Track daily activities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Monitor progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Review history</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
