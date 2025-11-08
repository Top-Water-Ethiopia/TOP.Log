import type { CaptainLogEntry } from "@/contexts/captain-log-context"

/**
 * Export utilities for Captain's Log entries
 */

/**
 * Convert entries to CSV format
 */
export function exportToCSV(entries: CaptainLogEntry[]): string {
  if (entries.length === 0) {
    return "No entries to export"
  }

  // CSV Headers
  const headers = [
    "Date",
    "Development Tasks",
    "Features Completed",
    "Challenges & Blockers",
    "Code Review & Priorities",
    "System Improvements",
    "Project Updates",
    "Created At",
    "Updated At",
  ]

  // Escape CSV field
  const escapeCSV = (field: string): string => {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  // Build CSV rows
  const rows = entries.map((entry) => [
    entry.date,
    escapeCSV(entry.developmentTasks),
    escapeCSV(entry.featuresCompleted),
    escapeCSV(entry.challengesAndBlockers),
    escapeCSV(entry.codeAndPriorities),
    escapeCSV(entry.systemImprovements),
    escapeCSV(entry.projectUpdates),
    entry.createdAt,
    entry.updatedAt,
  ])

  // Combine headers and rows
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

  return csv
}

/**
 * Download CSV file
 */
export function downloadCSV(entries: CaptainLogEntry[], filename: string = "captain-log-export.csv"): void {
  const csv = exportToCSV(entries)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export entries to JSON format
 */
export function exportToJSON(entries: CaptainLogEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

/**
 * Download JSON file
 */
export function downloadJSON(entries: CaptainLogEntry[], filename: string = "captain-log-export.json"): void {
  const json = exportToJSON(entries)
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Download Markdown file
 */
export function downloadMarkdown(entries: CaptainLogEntry[], filename: string = "captain-log-export.md"): void {
  const markdown = exportToMarkdown(entries)
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert entries to Markdown format
 */
export function exportToMarkdown(entries: CaptainLogEntry[]): string {
  if (entries.length === 0) {
    return "# Captain's Log\n\nNo entries to export."
  }

  // Sort entries by date (newest first)
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  let markdown = "# Captain's Log Export\n\n"
  markdown += `Exported on: ${new Date().toLocaleString()}\n\n`
  markdown += `Total Entries: ${entries.length}\n\n`
  markdown += "---\n\n"

  sortedEntries.forEach((entry) => {
    const date = new Date(entry.date + "T00:00:00")
    const formattedDate = date.toLocaleDateString("default", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    markdown += `## ${formattedDate}\n\n`

    if (entry.developmentTasks) {
      markdown += `### Development Tasks\n${entry.developmentTasks}\n\n`
    }

    if (entry.featuresCompleted) {
      markdown += `### Features Completed\n${entry.featuresCompleted}\n\n`
    }

    if (entry.challengesAndBlockers) {
      markdown += `### Challenges & Blockers\n${entry.challengesAndBlockers}\n\n`
    }

    if (entry.codeAndPriorities) {
      markdown += `### Code Review & Priorities\n${entry.codeAndPriorities}\n\n`
    }

    if (entry.systemImprovements) {
      markdown += `### System Improvements\n${entry.systemImprovements}\n\n`
    }

    if (entry.projectUpdates) {
      markdown += `### Project Updates\n${entry.projectUpdates}\n\n`
    }

    markdown += "---\n\n"
  })

  return markdown
}

/**
 * Import entries from JSON string
 */
export function importFromJSON(jsonString: string): CaptainLogEntry[] {
  try {
    const parsed = JSON.parse(jsonString)
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid JSON: Expected an array of entries")
    }

    // Validate entry structure
    const validEntries = parsed.filter((entry) => {
      return (
        entry.id &&
        entry.date &&
        typeof entry.developmentTasks === "string" &&
        typeof entry.featuresCompleted === "string" &&
        typeof entry.challengesAndBlockers === "string" &&
        typeof entry.codeAndPriorities === "string" &&
        typeof entry.systemImprovements === "string" &&
        typeof entry.projectUpdates === "string"
      )
    })

    return validEntries as CaptainLogEntry[]
  } catch (error) {
    console.error("Failed to import JSON:", error)
    throw new Error("Invalid JSON format")
  }
}

/**
 * Get date range summary
 */
export function getDateRangeSummary(entries: CaptainLogEntry[]): {
  earliest: string | null
  latest: string | null
  totalDays: number
} {
  if (entries.length === 0) {
    return { earliest: null, latest: null, totalDays: 0 }
  }

  const dates = entries.map((e) => new Date(e.date).getTime()).sort((a, b) => a - b)

  return {
    earliest: new Date(dates[0]).toLocaleDateString(),
    latest: new Date(dates[dates.length - 1]).toLocaleDateString(),
    totalDays: entries.length,
  }
}
