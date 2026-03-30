"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Calendar, Sparkles, Home } from "lucide-react"
import Link from "next/link"
import { formatDateHuman } from "@/lib/date-restrictions"

interface LogCompleteStateProps {
  completedDates: string[]
  nextAvailableDate: string
  hoursUntilNextAvailable: number
  streak?: number
}

function formatNextAvailable(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today at midnight"
  if (diffDays === 1) return "Tomorrow"
  return `In ${diffDays} days`
}

export function LogCompleteState({
  completedDates,
  nextAvailableDate,
  hoursUntilNextAvailable,
  streak = 3,
}: LogCompleteStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="flex flex-col items-center py-12 text-center">
          {/* Success Icon - toned down animation */}
          <div className="relative mb-6">
            <div className="bg-card relative flex h-24 w-24 items-center justify-center rounded-full border border-green-500/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-600" strokeWidth={1.5} />
              </div>
            </div>
            <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-400" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight">All Caught Up!</h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            You've successfully tracked all activities for the last 3 days. Your record is fully up to date.
          </p>

          {/* Streak Badge */}
          <div className="mt-4 flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-1.5">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-medium text-orange-700">{streak}-day streak complete</span>
          </div>

          {/* Completed Dates List */}
          <div className="bg-muted/50 mt-8 w-full max-w-sm rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Completed entries:</p>
            <div className="space-y-2">
              {completedDates.map((date) => (
                <div key={date} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span>{formatDateHuman(date)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Available with relative time */}
          <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">Next entry available:</span>{" "}
              <span className="text-muted-foreground">
                in {hoursUntilNextAvailable} hours ({formatNextAvailable(nextAvailableDate)})
              </span>
            </p>
          </div>

          {/* Clarifying microcopy */}
          <p className="text-muted-foreground mt-4 max-w-sm text-xs">
            You've completed all available entries. New entries unlock daily at midnight.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/logs">
                <Calendar className="h-4 w-4" />
                Review Your Logs
              </Link>
            </Button>
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
