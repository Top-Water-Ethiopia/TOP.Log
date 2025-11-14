"use client"

import { Button } from "./ui/button"
import { CheckCircle2, FileText, Calendar } from "lucide-react"

interface ThankYouPageProps {
  onNewReport: () => void
  onViewReports: () => void
  onBackHome: () => void
}

export function ThankYouPage({ onNewReport, onViewReports, onBackHome }: ThankYouPageProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-2xl w-full text-center space-y-8 px-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
            <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-primary" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h2 className="text-4xl font-bold text-foreground tracking-tight">
            Thank You!
          </h2>
          <p className="text-lg text-muted-foreground">
            Your report has been successfully submitted and saved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button
            onClick={onNewReport}
            size="lg"
            className="w-full sm:w-auto px-8 gap-2"
          >
            <FileText className="h-5 w-5" />
            Create Another Report
          </Button>

          <Button
            onClick={onViewReports}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-8 gap-2"
          >
            <Calendar className="h-5 w-5" />
            View All Reports
          </Button>
        </div>

        {/* Back to Home Link */}
        <div className="pt-4">
          <button
            onClick={onBackHome}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
