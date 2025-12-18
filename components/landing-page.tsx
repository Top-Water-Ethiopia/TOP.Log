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

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {canCreateNewReport && (
            <div 
              onClick={onNewReport}
              className="group cursor-pointer rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card/80"
            >
              <div className="flex flex-col items-center text-center h-full">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  <FileText className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">New Report</h3>
                <p className="text-muted-foreground text-sm">
                  Start a new daily report to log your activities and updates
                </p>
              </div>
            </div>
          )}
          
          <div 
            onClick={onViewReports}
            className="group cursor-pointer rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card/80"
          >
            <div className="flex flex-col items-center text-center h-full">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                <History className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">View Reports</h3>
              <p className="text-muted-foreground text-sm">
                Browse and search through your previously submitted reports
              </p>
            </div>
          </div>
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
