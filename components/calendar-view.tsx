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
    <div className="bg-card rounded-lg border border-border shadow-sm p-8 h-full flex flex-col">
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">{monthName}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="default" onClick={previousMonth} className="h-10 w-10 p-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentMonth(new Date())}
              className="px-3"
            >
              Today
            </Button>
            <Button variant="outline" size="default" onClick={nextMonth} className="h-10 w-10 p-0">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Week Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2 flex-1">
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
                className={`min-h-[60px] rounded-xl text-base font-semibold transition-all flex flex-col items-center justify-start p-2 relative group
                  ${
                    isFuture
                      ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-40"
                      : isSelected
                        ? "bg-primary text-primary-foreground shadow-lg scale-105"
                        : isToday
                          ? "bg-accent text-accent-foreground ring-2 ring-accent hover:shadow-md"
                          : hasEntry
                            ? "bg-secondary text-secondary-foreground hover:bg-accent/20 hover:shadow-md border-2 border-transparent hover:border-accent"
                            : "bg-secondary/50 text-secondary-foreground hover:bg-muted hover:shadow-sm"
                  }
                `}
                title={isFuture ? "Cannot log future dates" : hasEntry ? "View entry" : "Create entry"}
              >
                <span className="text-sm mb-1">{day}</span>
                {/* Entry Indicator - More prominent */}
                {hasEntry && !isFuture && (
                  <div className="flex items-center justify-center w-full mt-auto">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#099748' }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend & Stats */}
        <div className="pt-6 mt-6 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-accent ring-2 ring-accent" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#099748' }} />
                <span>Has report</span>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">{entries.filter(e => {
                  const entryDate = new Date(e.date)
                  return entryDate.getMonth() === currentMonth.getMonth() && 
                         entryDate.getFullYear() === currentMonth.getFullYear()
                }).length}</span> reports this month
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">{entries.length}</span> total reports
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
