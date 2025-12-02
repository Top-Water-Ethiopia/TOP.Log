"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/supabase-log-context"
import { ArrowLeft, Edit, Trash2, Target, CheckCircle, AlertTriangle, ListChecks } from "lucide-react"
import type { QuestionResponse } from "@/lib/rbac/types"
import { canUpdateEntryForDate } from "@/lib/date-restrictions"

interface EntryDetailsProps {
  date: string
  onEdit: () => void
  onBack: () => void
  onViewEntry?: (date: string) => void
}

export function EntryDetails({ date, onEdit, onBack }: EntryDetailsProps) {
  const { deleteEntry, entries } = useCaptainLog()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Use useMemo to avoid re-creating on every render and prevent audit log spam
  const currentEntry = useMemo(() => entries.find(entry => entry.date === date), [entries, date])

  const formatCustomResponseValue = (response: QuestionResponse) => {
    const questionType = response.questionType ?? "text"
    const { value } = response

    if (value === null || value === undefined || value === "") {
      return "Not provided"
    }

    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : "Not provided"
    }

    if (questionType === "checkbox") {
      return value ? "Yes" : "No"
    }

    if (questionType === "date" && typeof value === "string") {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
    }

    return String(value)
  }

  const handleDelete = () => {
    if (currentEntry) {
      deleteEntry(currentEntry.id)
      onBack()
    }
  }

  // Check if entry can be edited (within 2-day window)
  const canEdit = useMemo(() => {
    if (!currentEntry) return false
    const validation = canUpdateEntryForDate(currentEntry.date, currentEntry.createdAt)
    return validation.isValid
  }, [currentEntry])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })
  }

  // Industrial standard: Show ONLY role-specific responses in Daily Log view
  // No legacy fields, no generic questions - only custom role-based Q&A

  if (!currentEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Entry Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
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
    <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-foreground">Daily Log</h2>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button 
              size="sm" 
              onClick={onEdit} 
              className="gap-2"
              disabled={!canEdit}
              title={!canEdit ? "Entries older than 2 days cannot be edited" : "Edit this entry"}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Entry Content - Only Role-Specific Responses */}
        <Card className="p-6 flex-1 overflow-y-auto shadow-sm">
          <div className="space-y-8">
            {currentEntry.customResponses && currentEntry.customResponses.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <ListChecks className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">
                    Role-Specific Responses
                  </h3>
                </div>
                <div className="space-y-4">
                  {currentEntry.customResponses.map((response) => {
                    const questionType = response.questionType ?? "text"

                    return (
                      <div
                        key={`${response.questionId}-${response.timestamp}`}
                        className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {response.questionLabel ?? response.questionKey}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {questionType}
                            </Badge>
                            {response.questionCategory && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {response.questionCategory}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {formatCustomResponseValue(response as QuestionResponse)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <div>
                    <p className="text-base font-medium text-foreground">No Role-Specific Responses</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      This entry does not contain any role-specific question responses.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Metadata */}
          <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span>Created {formatTime(currentEntry.createdAt)}</span>
              <span>•</span>
              <span>Updated {formatTime(currentEntry.updatedAt)}</span>
            </div>
            
            {/* Delete Button - Disabled with Explanation */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={true}
                className="gap-2 text-muted-foreground cursor-not-allowed opacity-50"
                title="Deleting entries is not allowed due to data retention policy"
              >
                <Trash2 className="h-4 w-4" />
                Delete (Disabled)
              </Button>
            </div>
          </div>
        </Card>
      </div>
  )
}
