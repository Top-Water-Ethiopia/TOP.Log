"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Calendar, ArrowRight } from "lucide-react"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/supabase-log-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface SearchDialogProps {
  onSelectEntry?: (date: string) => void
}

export function SearchDialog({ onSelectEntry }: SearchDialogProps) {
  const { entries } = useCaptainLog()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Search through all entry fields
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const query = searchQuery.toLowerCase()

    return entries.filter((entry) => {
      return (
        entry.date.includes(query) ||
        entry.developmentTasks.toLowerCase().includes(query) ||
        entry.featuresCompleted.toLowerCase().includes(query) ||
        entry.challengesAndBlockers.toLowerCase().includes(query) ||
        entry.codeAndPriorities.toLowerCase().includes(query) ||
        entry.systemImprovements.toLowerCase().includes(query) ||
        entry.projectUpdates.toLowerCase().includes(query)
      )
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [entries, searchQuery])

  const handleSelectEntry = (date: string) => {
    setIsOpen(false)
    setSearchQuery("")
    onSelectEntry?.(date)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { 
      weekday: "short",
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    })
  }

  const highlightMatch = (text: string, query: string): { text: string; hasMatch: boolean } => {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const hasMatch = lowerText.includes(lowerQuery)
    
    return { text: text.substring(0, 100) + (text.length > 100 ? "..." : ""), hasMatch }
  }

  const getMatchingSections = (entry: CaptainLogEntry, query: string): string[] => {
    const sections: string[] = []
    const q = query.toLowerCase()

    if (entry.developmentTasks.toLowerCase().includes(q)) sections.push("Dev Tasks")
    if (entry.featuresCompleted.toLowerCase().includes(q)) sections.push("Features")
    if (entry.challengesAndBlockers.toLowerCase().includes(q)) sections.push("Challenges")
    if (entry.codeAndPriorities.toLowerCase().includes(q)) sections.push("Code Review")
    if (entry.systemImprovements.toLowerCase().includes(q)) sections.push("Improvements")
    if (entry.projectUpdates.toLowerCase().includes(q)) sections.push("Updates")

    return sections
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Search Log Entries</DialogTitle>
          <DialogDescription>
            Search across all your log entries. {entries.length} total entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for tasks, features, challenges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <ScrollArea className="h-[400px] rounded-md border">
            {searchQuery.trim() === "" ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Start typing to search your entries</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No entries found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {searchResults.map((entry) => {
                  const matchingSections = getMatchingSections(entry, searchQuery)
                  
                  return (
                    <div
                      key={entry.id}
                      className="p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleSelectEntry(entry.date)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatDate(entry.date)}</span>
                          </div>

                          {matchingSections.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {matchingSections.map((section) => (
                                <Badge key={section} variant="secondary" className="text-xs">
                                  {section}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Preview text from matching section */}
                          {entry.developmentTasks && highlightMatch(entry.developmentTasks, searchQuery).hasMatch && (
                            <p className="text-sm text-muted-foreground">
                              {highlightMatch(entry.developmentTasks, searchQuery).text}
                            </p>
                          )}
                        </div>
                        
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {searchResults.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Found {searchResults.length} {searchResults.length === 1 ? "entry" : "entries"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
