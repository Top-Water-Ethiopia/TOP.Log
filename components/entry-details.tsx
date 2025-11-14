"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/captain-log-context"
import { ArrowLeft, Edit, Trash2, Target, CheckCircle, AlertTriangle, ListChecks } from "lucide-react"
import type { QuestionResponse } from "@/lib/rbac/types"

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })
  }

  // Display new 3-question format if available, otherwise fall back to legacy fields
  const hasNewFormat = currentEntry && ((currentEntry as any).objectives || (currentEntry as any).keyResults)

  const newFields = [
    { id: "objectives", label: "Objectives", icon: Target },
    { id: "keyResults", label: "Key Results", icon: CheckCircle },
    { id: "challenges", label: "Challenges", icon: AlertTriangle },
  ]

  const legacyFields = [
    { id: "developmentTasks", label: "Development Tasks" },
    { id: "featuresCompleted", label: "Features Completed" },
    { id: "challengesAndBlockers", label: "Challenges & Blockers" },
    { id: "codeAndPriorities", label: "Code Review & Priorities" },
    { id: "systemImprovements", label: "System Improvements" },
    { id: "projectUpdates", label: "Project Updates" },
  ]

  const fields = hasNewFormat ? newFields : legacyFields

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
            <Button size="sm" onClick={onEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Entry Content */}
        <Card className="p-6 flex-1 overflow-y-auto shadow-sm">
          <div className="space-y-8">
            {fields.map((field, index) => {
              const content = currentEntry[field.id as keyof CaptainLogEntry]
              return (
                <div key={field.id}>
                  {index > 0 && <div className="border-t border-border mb-8" />}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {hasNewFormat && (field as any).icon && (() => {
                        const IconComponent = (field as any).icon
                        return <IconComponent className="h-5 w-5" />
                      })()}
                      <h3 className="text-lg font-semibold text-foreground">
                        {field.label}
                      </h3>
                    </div>
                    {content ? (
                      <div className={`${hasNewFormat ? 'bg-muted/30 p-4 rounded-lg border border-border/50' : ''}`}>
                        <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                          {String(content)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic pl-1">
                        {hasNewFormat && field.id === 'challenges'
                          ? 'No challenges reported'
                          : 'No information provided'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {currentEntry.customResponses && currentEntry.customResponses.length > 0 && (
              <div className="border-t border-border pt-8">
                <div className="flex items-center gap-2 mb-4">
                  <ListChecks className="h-5 w-5" />
                  <h3 className="text-lg font-semibold text-foreground">
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
                          {formatCustomResponseValue(response)}
                        </p>
                      </div>
                    )
                  })}
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
            
            {/* Delete Button */}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground font-medium mr-2">Delete this entry?</span>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </Card>
      </div>
  )
}
