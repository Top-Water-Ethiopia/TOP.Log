"use client"

import { useState } from "react"
import { CalendarView } from "./calendar-view"
import { EntryForm } from "./entry-form"
import { EntryDetails } from "./entry-details"

export function MainLayout() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"calendar" | "form" | "details">("calendar")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Captain's Log</h1>
              <p className="text-sm text-muted-foreground mt-1">IT Department Daily Tracker</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Calendar */}
          <div className="lg:col-span-1">
            <CalendarView
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date)
                setViewMode("form")
              }}
            />
          </div>

          {/* Right: Content Area */}
          <div className="lg:col-span-2">
            {viewMode === "form" && (
              <EntryForm
                date={selectedDate}
                onSave={() => setViewMode("details")}
                onCancel={() => setViewMode("calendar")}
              />
            )}
            {viewMode === "details" && (
              <EntryDetails
                date={selectedDate}
                onEdit={() => setViewMode("form")}
                onBack={() => setViewMode("calendar")}
              />
            )}
            {viewMode === "calendar" && (
              <div className="bg-card rounded-lg border border-border p-8 text-center">
                <p className="text-muted-foreground">Select a date from the calendar to view or create an entry</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
