"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/captain-log-context"
import { ArrowLeft, Edit, Trash2, Calendar } from "lucide-react"

interface EntryDetailsProps {
  date: string
  onEdit: () => void
  onBack: () => void
}

export function EntryDetails({ date, onEdit, onBack }: EntryDetailsProps) {
  const { getEntryByDate, deleteEntry, entries } = useCaptainLog()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<"current" | "history">("current")

  const currentEntry = getEntryByDate(date)

  // Get sorted history of all entries (most recent first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [entries])

  const handleDelete = () => {
    if (currentEntry) {
      deleteEntry(currentEntry.id)
      onBack()
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })
  }

  const fields = [
    { id: "developmentTasks", label: "Development Tasks" },
    { id: "featuresCompleted", label: "Features Completed" },
    { id: "challengesAndBlockers", label: "Challenges & Blockers" },
    { id: "codeAndPriorities", label: "Code Review & Priorities" },
    { id: "systemImprovements", label: "System Improvements" },
    { id: "projectUpdates", label: "Project Updates" },
  ]

  if (!currentEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Entry Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No entry found for this date</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Entry Details</h2>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button size="sm" onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setViewMode("current")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            viewMode === "current"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Today's Entry
        </button>
        <button
          onClick={() => setViewMode("history")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            viewMode === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          History ({sortedEntries.length})
        </button>
      </div>

      {/* Current Entry View */}
      {viewMode === "current" && (
        <div className="space-y-6">
          {fields.map((field) => {
            const content = currentEntry[field.id as keyof CaptainLogEntry]
            return (
              <div key={field.id} className="space-y-2">
                <h3 className="font-medium text-foreground">{field.label}</h3>
                {content ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{String(content)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No information provided</p>
                )}
              </div>
            )
          })}

          {/* Metadata */}
          <div className="pt-6 border-t border-border space-y-2">
            <p className="text-xs text-muted-foreground">Created: {formatTime(currentEntry.createdAt)}</p>
            <p className="text-xs text-muted-foreground">Last updated: {formatTime(currentEntry.updatedAt)}</p>
          </div>

          {/* Delete Button */}
          <div className="pt-6 border-t border-border">
            {showDeleteConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground font-medium">Are you sure you want to delete this entry?</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    Delete Entry
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete Entry
              </Button>
            )}
          </div>
        </div>
      )}

      {/* History View */}
      {viewMode === "history" && (
        <div className="space-y-3">
          {sortedEntries.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No entries yet</p>
            </Card>
          ) : (
            sortedEntries.map((entry) => (
              <Card key={entry.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{formatDate(entry.date)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Last updated: {formatTime(entry.updatedAt)}</p>
                  </div>
                  {entry.date !== date && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onBack()
                      }}
                      className="ml-2"
                    >
                      View
                    </Button>
                  )}
                  {entry.date === date && (
                    <span className="text-xs font-medium text-accent px-2 py-1 bg-accent/10 rounded">Current</span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
