"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/supabase-log-context"
import { formatLocalDate, getMinAllowedDate, getToday, isDateInAllowedRange } from "@/lib/date-restrictions"

interface CalendarViewProps {
  selectedDate: string
  onDateSelect: (date: string) => void
  entries?: CaptainLogEntry[]
}

export function CalendarView({ selectedDate, onDateSelect, entries: entriesProp }: CalendarViewProps) {
  const { entries: contextEntries } = useCaptainLog()
  const entries = entriesProp ?? contextEntries
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
    return formatLocalDate(date)
  }

  const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" })
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="bg-card border-border flex h-full flex-col rounded-lg border p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="flex flex-1 flex-col space-y-4">
        {/* Month Navigation */}
        <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-foreground text-xl font-bold sm:text-2xl">{monthName}</h2>
          <div className="flex flex-wrap gap-2">
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
        <div className="mb-2 grid grid-cols-7 gap-1 sm:mb-3 sm:gap-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-muted-foreground py-1 text-center text-[11px] font-semibold sm:py-2 sm:text-sm"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 grid-rows-6 gap-1 sm:gap-2">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const dateString = formatDateString(day)
            const hasEntry = datesWithEntries.has(dateString)
            const isSelected = dateString === selectedDate
            const today = getToday()
            const isToday = dateString === today
            const isFuture = dateString > today
            const isInEditWindow = isDateInAllowedRange(dateString)
            const isLockedForEdits = dateString < getMinAllowedDate()
            const isCreateLocked = !hasEntry && isLockedForEdits

            return (
              <button
                key={day}
                onClick={() => !isFuture && !isCreateLocked && onDateSelect(dateString)}
                disabled={isFuture || isCreateLocked}
                className={`group relative flex aspect-square w-full flex-col items-center justify-start rounded-xl p-1.5 text-sm font-semibold transition-all sm:p-2 sm:text-base ${
                  isFuture
                    ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-40"
                    : isSelected
                      ? "bg-primary text-primary-foreground shadow-lg sm:scale-105"
                      : isToday
                        ? "bg-primary/5 text-primary ring-primary border-primary/50 hover:bg-primary/10 border shadow-sm ring-2"
                        : hasEntry
                          ? isLockedForEdits
                            ? "bg-secondary/70 text-secondary-foreground/70 hover:bg-accent/10 border-border border-2 border-dashed hover:shadow-sm"
                            : "bg-secondary text-secondary-foreground hover:bg-accent/20 hover:border-accent border-2 border-transparent hover:shadow-md"
                          : isCreateLocked
                            ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-secondary/50 text-secondary-foreground hover:bg-muted hover:shadow-sm"
                } `}
                title={
                  isFuture
                    ? "Cannot log future dates"
                    : hasEntry
                      ? isInEditWindow
                        ? "View/Edit entry"
                        : "View only (locked: older than 2 days)"
                      : isCreateLocked
                        ? "Locked (cannot create entries older than 2 days)"
                        : "Create entry"
                }
              >
                <div className="flex w-full items-start justify-between">
                  <span className="mb-1 text-sm">{day}</span>
                </div>

                {isToday && !isSelected && (
                  <span className="bg-primary/10 text-primary pointer-events-none absolute top-1 right-1 inline-flex max-w-[calc(100%-2.5rem)] truncate rounded-full px-1.5 py-0.5 text-[9px] leading-none font-medium sm:top-2 sm:right-2 sm:max-w-[calc(100%-3rem)] sm:px-2 sm:text-[10px]">
                    Today
                  </span>
                )}

                {!isFuture && isLockedForEdits ? (
                  <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                    <Lock
                      className={
                        isSelected ? "text-primary-foreground/90 h-3.5 w-3.5" : "text-muted-foreground/70 h-3.5 w-3.5"
                      }
                    />
                  </div>
                ) : null}

                {/* Entry Indicator - More prominent */}
                {hasEntry && !isFuture && (
                  <div className="mt-auto flex w-full items-center justify-center">
                    <div
                      className={`h-2 w-2 rounded-full ${isLockedForEdits ? "opacity-50" : ""}`}
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
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                <span>Locked (edits disabled)</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-6">
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
