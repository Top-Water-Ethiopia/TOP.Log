import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatLocalDate } from "@/lib/date-restrictions"
import { buildLogsPageHref, getCurrentMonthValue, getMonthCalendarDays, shiftMonthValue } from "@/lib/logs-page-filters"
import type { CalendarDaySummary } from "@/lib/logs/types"

interface LogsCalendarProps {
  daySummaries: CalendarDaySummary[]
  departmentId?: string
  month: string
  selectedDate?: string
}

export function LogsCalendar({ daySummaries, departmentId, month, selectedDate }: LogsCalendarProps) {
  const monthAnchor = new Date(`${month}-01T00:00:00`)
  const monthLabel = monthAnchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const previousMonth = shiftMonthValue(month, -1)
  const nextMonth = shiftMonthValue(month, 1)
  const currentMonth = getCurrentMonthValue()
  const calendarDays = getMonthCalendarDays(month)
  const daySummaryMap = new Map(daySummaries.map((summary) => [summary.date, summary.entryCount]))
  const todayValue = formatLocalDate(new Date())

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{monthLabel}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Select a date to review the logs submitted on that day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildLogsPageHref({
                  view: "calendar",
                  departmentId,
                  month: currentMonth,
                })}
              >
                Today
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild>
                <Link
                  href={buildLogsPageHref({
                    view: "calendar",
                    departmentId,
                    month: previousMonth,
                  })}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous month</span>
                </Link>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link
                  href={buildLogsPageHref({
                    view: "calendar",
                    departmentId,
                    month: nextMonth,
                  })}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next month</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel) => (
            <div key={dayLabel} className="py-2">
              {dayLabel}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((dateValue, index) => {
            if (!dateValue) {
              return <div key={`empty-${index}`} className="aspect-square rounded-xl" />
            }

            const entryCount = daySummaryMap.get(dateValue) || 0
            const isSelected = dateValue === selectedDate
            const isToday = dateValue === todayValue

            return (
              <Link
                key={dateValue}
                href={buildLogsPageHref({
                  view: "calendar",
                  date: dateValue,
                  departmentId,
                  month,
                })}
                className={`flex aspect-square flex-col justify-between rounded-xl border p-3 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : entryCount > 0
                      ? "hover:border-primary/40 hover:bg-primary/5 border-border"
                      : "border-border/60 hover:bg-muted/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {new Date(`${dateValue}T00:00:00`).getDate()}
                  </span>
                  {isToday ? (
                    <span className="bg-primary/10 text-primary hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline">
                      Today
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto">
                  {entryCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="hidden text-xs text-slate-600 sm:inline">
                        {entryCount} log{entryCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : (
                    <span className="hidden text-xs text-slate-400 sm:inline">No logs</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Dates with submitted logs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 border-primary h-3 w-3 rounded border" />
            <span>Selected date</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
