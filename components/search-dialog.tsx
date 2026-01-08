"use client"

import { useEffect, useMemo, useState } from "react"
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

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (needle[i] === haystack[j]) i++
  }
  return i === needle.length
}

function scoreMatch(term: string, text: string): number {
  if (!term || !text) return 0
  if (text.includes(term)) {
    const idx = text.indexOf(term)
    const proximityBoost = idx === 0 ? 0.2 : idx < 20 ? 0.1 : 0
    return 1 + proximityBoost
  }

  if (isSubsequence(term, text)) {
    const density = term.length / Math.max(text.length, 1)
    return 0.45 + Math.min(0.35, density)
  }

  return 0
}

interface SearchDialogProps {
  onSelectEntry?: (date: string) => void
  entries?: CaptainLogEntry[]
}

export function SearchDialog({ onSelectEntry, entries: entriesProp }: SearchDialogProps) {
  const { entries: contextEntries } = useCaptainLog()
  const entries = entriesProp ?? contextEntries
  const [isOpen, setIsOpen] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchInput)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const isDebouncing = searchInput !== debouncedQuery

  const searchableEntries = useMemo(() => {
    return entries.map((entry) => {
      const fields = {
        date: normalizeForSearch(entry.date ?? ""),
        developmentTasks: normalizeForSearch(entry.developmentTasks ?? ""),
        featuresCompleted: normalizeForSearch(entry.featuresCompleted ?? ""),
        challengesAndBlockers: normalizeForSearch(entry.challengesAndBlockers ?? ""),
        codeAndPriorities: normalizeForSearch(entry.codeAndPriorities ?? ""),
        systemImprovements: normalizeForSearch(entry.systemImprovements ?? ""),
        projectUpdates: normalizeForSearch(entry.projectUpdates ?? ""),
      }

      return { entry, fields }
    })
  }, [entries])

  // Search through all entry fields
  const searchResults = useMemo(() => {
    const raw = debouncedQuery.trim()
    if (!raw) {
      return []
    }

    const normalizedQuery = normalizeForSearch(raw)
    const terms = normalizedQuery.split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []

    const weightedFields: Array<{ key: keyof (typeof searchableEntries)[number]["fields"]; weight: number }> = [
      { key: "developmentTasks", weight: 1.3 },
      { key: "featuresCompleted", weight: 1.2 },
      { key: "challengesAndBlockers", weight: 1.1 },
      { key: "codeAndPriorities", weight: 1.0 },
      { key: "systemImprovements", weight: 0.9 },
      { key: "projectUpdates", weight: 0.9 },
      { key: "date", weight: 0.4 },
    ]

    const scored = searchableEntries
      .map(({ entry, fields }) => {
        let total = 0
        let matched = 0

        // Phrase boost (when the whole query appears contiguously)
        let phraseBest = 0
        for (const { key, weight } of weightedFields) {
          const s = scoreMatch(normalizedQuery, fields[key]) * weight
          if (s > phraseBest) phraseBest = s
        }
        if (phraseBest > 0) {
          total += phraseBest * 0.6
        }

        for (const term of terms) {
          let best = 0
          for (const { key, weight } of weightedFields) {
            const s = scoreMatch(term, fields[key]) * weight
            if (s > best) best = s
          }
          if (best > 0) {
            matched += 1
            total += best
          }
        }

        // Google-like behavior: allow partial matches, but rank higher when more terms match.
        if (matched === 0) return null
        const coverage = matched / Math.max(terms.length, 1)
        const coverageBoost = 0.75 + 0.35 * coverage
        return { entry, score: total * coverageBoost }
      })
      .filter((x): x is { entry: CaptainLogEntry; score: number } => x !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime()
      })

    return scored.map((s) => s.entry)
  }, [searchableEntries, debouncedQuery])

  const handleSelectEntry = (date: string) => {
    setIsOpen(false)
    setSearchInput("")
    setDebouncedQuery("")
    onSelectEntry?.(date)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
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

    if ((entry.developmentTasks ?? "").toLowerCase().includes(q)) sections.push("Dev Tasks")
    if ((entry.featuresCompleted ?? "").toLowerCase().includes(q)) sections.push("Features")
    if ((entry.challengesAndBlockers ?? "").toLowerCase().includes(q)) sections.push("Challenges")
    if ((entry.codeAndPriorities ?? "").toLowerCase().includes(q)) sections.push("Code Review")
    if ((entry.systemImprovements ?? "").toLowerCase().includes(q)) sections.push("Improvements")
    if ((entry.projectUpdates ?? "").toLowerCase().includes(q)) sections.push("Updates")

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
          <DialogDescription>Search across all your log entries. {entries.length} total entries.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <Input
              placeholder="Search for tasks, features, challenges..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <ScrollArea className="h-[400px] rounded-md border">
            {searchInput.trim() === "" ? (
              <div className="text-muted-foreground p-8 text-center">
                <Search className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>Start typing to search your entries</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-muted-foreground p-8 text-center">
                <p>No entries found matching "{debouncedQuery}"</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {isDebouncing && <div className="text-muted-foreground text-xs">Searching…</div>}
                {searchResults.map((entry) => {
                  const matchingSections = getMatchingSections(entry, debouncedQuery)

                  return (
                    <div
                      key={entry.id}
                      className="hover:bg-accent cursor-pointer rounded-lg border p-4 transition-colors"
                      onClick={() => handleSelectEntry(entry.date)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="text-muted-foreground h-4 w-4" />
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
                          {entry.developmentTasks &&
                            highlightMatch(entry.developmentTasks, debouncedQuery).hasMatch && (
                              <p className="text-muted-foreground text-sm">
                                {highlightMatch(entry.developmentTasks, debouncedQuery).text}
                              </p>
                            )}
                        </div>

                        <ArrowRight className="text-muted-foreground mt-1 h-4 w-4 flex-shrink-0" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {searchResults.length > 0 && (
            <div className="text-muted-foreground text-center text-sm">
              Found {searchResults.length} {searchResults.length === 1 ? "entry" : "entries"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
