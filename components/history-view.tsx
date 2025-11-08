"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { ArrowLeft, Calendar, Search, FileText, Target, CheckCircle, AlertTriangle } from "lucide-react"

interface HistoryViewProps {
  onSelectEntry: (date: string) => void
  onBack: () => void
}

export function HistoryView({ onSelectEntry, onBack }: HistoryViewProps) {
  const { entries } = useCaptainLog()
  const [searchQuery, setSearchQuery] = useState("")

  // Get sorted history of all entries (most recent first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [entries])

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return sortedEntries

    const query = searchQuery.toLowerCase()
    return sortedEntries.filter((entry) => {
      const searchableText = [
        entry.date,
        (entry as any).objectives || "",
        (entry as any).keyResults || "",
        (entry as any).challenges || "",
        entry.developmentTasks || "",
        entry.featuresCompleted || "",
        entry.challengesAndBlockers || "",
      ].join(" ").toLowerCase()

      return searchableText.includes(query)
    })
  }, [sortedEntries, searchQuery])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })
  }

  // Check if entry uses new format
  const hasNewFormat = (entry: any): boolean => {
    return !!(entry.objectives || entry.keyResults)
  }

  // Get formatted content for entry card
  const getEntryContent = (entry: any) => {
    const isNew = hasNewFormat(entry)
    
    if (isNew) {
      return {
        format: "new" as const,
        fields: [
          { label: "Objectives", value: entry.objectives, icon: Target },
          { label: "Key Results", value: entry.keyResults, icon: CheckCircle },
          { label: "Challenges", value: entry.challenges, icon: AlertTriangle },
        ].filter(f => f.value), // Only show fields with content
        preview: ""
      }
    } else {
      // Legacy format
      return {
        format: "legacy" as const,
        fields: [],
        preview: (entry.developmentTasks || "No content").substring(0, 120) + 
                 (entry.developmentTasks && entry.developmentTasks.length > 120 ? "..." : "")
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Entry History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            {searchQuery && " found"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Calendar
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search entries by date or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Entry List */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {searchQuery ? (
              <>
                <p className="text-foreground font-medium">No entries found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search terms
                </p>
              </>
            ) : (
              <>
                <p className="text-foreground font-medium">No entries yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start by creating your first daily log!
                </p>
              </>
            )}
          </Card>
        ) : (
          filteredEntries.map((entry) => {
            const content = getEntryContent(entry)
            return (
              <Card
                key={entry.id}
                className="p-5 cursor-pointer transition-all hover:shadow-md hover:bg-muted/30 border-l-4 border-l-transparent hover:border-l-primary"
                onClick={() => onSelectEntry(entry.date)}
              >
                <div className="flex items-start gap-4">
                  {/* Date Badge */}
                  <div className="flex-shrink-0 w-20 text-center">
                    <div className="bg-primary/10 rounded-lg p-3">
                      <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                      <div className="text-xs font-semibold text-primary">
                        {formatShortDate(entry.date)}
                      </div>
                    </div>
                  </div>

                  {/* Entry Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="font-semibold text-foreground">
                        {formatDate(entry.date)}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Updated {formatTime(entry.updatedAt)}
                      </span>
                    </div>

                    {/* Show formatted content */}
                    {content.format === "new" ? (
                      <div className="space-y-2">
                        {content.fields.map((field, idx) => {
                          const FieldIcon = (field as any).icon
                          return (
                            <div key={idx} className="text-sm flex items-start gap-2">
                              {FieldIcon && <FieldIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground">{field.label}:</span>
                                <span className="text-muted-foreground ml-2 line-clamp-1">
                                  {field.value}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {content.preview}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
