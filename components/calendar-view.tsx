"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCaptainLog } from "@/contexts/captain-log-context"

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
    <div className="bg-card rounded-lg border border-border shadow-sm p-6 h-full flex flex-col">
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">{monthName}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth} className="h-8 w-8 p-0 bg-transparent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth} className="h-8 w-8 p-0 bg-transparent">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
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

            return (
              <button
                key={day}
                onClick={() => !isFuture && onDateSelect(dateString)}
                disabled={isFuture}
                className={`aspect-square rounded-lg text-sm font-medium transition-all flex items-center justify-center relative
                  ${
                    isFuture
                      ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-40"
                      : isSelected
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                        : isToday
                          ? "bg-accent text-accent-foreground ring-2 ring-accent"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }
                `}
                title={isFuture ? "Cannot log future dates" : hasEntry ? "View entry" : "Create entry"}
              >
                {day}
                {/* Entry Indicator Dot */}
                {hasEntry && !isFuture && (
                  <div className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="pt-4 mt-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-accent ring-2 ring-accent" />
            <span className="text-xs text-muted-foreground font-medium">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Has entry</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-secondary/30 opacity-40" />
            <span className="text-xs text-muted-foreground">Future (disabled)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
