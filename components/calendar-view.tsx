"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { isDateInAllowedRange } from "@/lib/date-restrictions"

interface CalendarViewProps {
  selectedDate: string
  onDateSelect: (date: string) => void
}

export function CalendarView({ selectedDate, onDateSelect }: CalendarViewProps) {
  const { entries } = useCaptainLog()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Create a set of dates with entries for quick lookup
  const datesWithEntries = useMemo(() => {
    return new Set(entries.map((entry) => entry.date))
  }, [entries])

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)

  // Generate calendar days array
  const calendarDays = useMemo(() => {
    const days = []
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }, [firstDay, daysInMonth])

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const formatDateString = (day: number): string => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return date.toISOString().split("T")[0]
  }

  const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" })
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="bg-card border-border flex h-full flex-col rounded-lg border p-8 shadow-sm">
      <div className="flex flex-1 flex-col space-y-4">
        {/* Month Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-bold">{monthName}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="default" onClick={previousMonth} className="h-10 w-10 p-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="px-3">
              Today
            </Button>
            <Button variant="outline" size="default" onClick={nextMonth} className="h-10 w-10 p-0">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Week Day Headers */}
        <div className="mb-3 grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day} className="text-muted-foreground py-2 text-center text-sm font-semibold">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid flex-1 grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const dateString = formatDateString(day)
            const hasEntry = datesWithEntries.has(dateString)
            const isSelected = dateString === selectedDate
            const today = new Date().toISOString().split("T")[0]
            const isToday = dateString === today
            const isFuture = dateString > today
            const isEditable = isDateInAllowedRange(dateString)
            const isPast = dateString < today && !isEditable

            return (
              <button
                key={day}
                onClick={() => !isFuture && onDateSelect(dateString)}
                disabled={isFuture}
                className={`group relative flex min-h-[60px] flex-col items-center justify-start rounded-xl p-2 text-base font-semibold transition-all ${
                  isFuture
                    ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-40"
                    : isSelected
                      ? "bg-primary text-primary-foreground scale-105 shadow-lg"
                      : isToday
                        ? "bg-primary/5 text-primary ring-primary border-primary/50 hover:bg-primary/10 border shadow-sm ring-2"
                        : hasEntry
                          ? isPast
                            ? "bg-secondary/70 text-secondary-foreground/70 hover:bg-accent/10 border-border border-2 border-dashed hover:shadow-sm"
                            : "bg-secondary text-secondary-foreground hover:bg-accent/20 hover:border-accent border-2 border-transparent hover:shadow-md"
                          : isEditable
                            ? "bg-secondary/50 text-secondary-foreground hover:bg-muted hover:shadow-sm"
                            : "bg-secondary/30 text-muted-foreground/60 opacity-60"
                } `}
                title={
                  isFuture
                    ? "Cannot log future dates"
                    : isPast && hasEntry
                      ? "View only (older than 2 days)"
                      : hasEntry
                        ? "View/Edit entry"
                        : isEditable
                          ? "Create entry (within 2-day window)"
                          : "Not editable (older than 2 days)"
                }
              >
                <div className="flex w-full items-start justify-between">
                  <span className="mb-1 text-sm">{day}</span>
                  {isToday && !isSelected && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] leading-none font-medium">
                      Today
                    </span>
                  )}
                </div>
                {/* Entry Indicator - More prominent */}
                {hasEntry && !isFuture && (
                  <div className="mt-auto flex w-full items-center justify-center">
                    <div
                      className={`h-2 w-2 rounded-full ${isPast ? "opacity-50" : ""}`}
                      style={{ backgroundColor: "#099748" }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend & Stats */}
        <div className="border-border mt-6 border-t pt-6">
          <div className="flex flex-col gap-4">
            {/* Legend */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="bg-background ring-primary h-3 w-3 rounded ring-2" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#099748" }} />
                <span>Editable (last 2 days)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full opacity-50" style={{ backgroundColor: "#099748" }} />
                <span>View only (older)</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-muted-foreground">
                <span className="text-foreground font-semibold">
                  {
                    entries.filter((e) => {
                      const entryDate = new Date(e.date)
                      return (
                        entryDate.getMonth() === currentMonth.getMonth() &&
                        entryDate.getFullYear() === currentMonth.getFullYear()
                      )
                    }).length
                  }
                </span>{" "}
                reports this month
              </div>
              <div className="text-muted-foreground">
                <span className="text-foreground font-semibold">{entries.length}</span> total reports
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
