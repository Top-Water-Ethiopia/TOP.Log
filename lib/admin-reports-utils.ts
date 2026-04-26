import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "date-fns"

export type DateRangeType = "today" | "week" | "month" | "quarter" | "custom"
export type Range = { start: Date; end: Date }

/**
 * Standardized date range utility for admin reports.
 * Ensures consistency between dashboard stats and entry filters.
 *
 * @param type - The type of date range to calculate
 * @param now - The reference date (usually current time)
 * @returns Range object with inclusive start and end boundaries
 */
export function getDateRange(type: DateRangeType, now: Date): Range {
  const end = endOfDay(now)
  switch (type) {
    case "today":
      return { start: startOfDay(now), end }
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end } // Monday (Ethiopia business week)
    case "month":
      return { start: startOfMonth(now), end }
    case "quarter":
      const month = now.getMonth()
      const quarterStartMonth = Math.floor(month / 3) * 3
      return { start: new Date(now.getFullYear(), quarterStartMonth, 1), end }
    case "custom":
      return { start: startOfDay(now), end } // Custom ranges handled separately
  }
}

/**
 * Resolves a user's name from entry data with robust fallbacks.
 * Ensures contributors are identifiable even when profile data is missing.
 *
 * @param entry - The entry object containing user profile and email data
 * @returns A human-readable name string
 */
export function resolveUserName(entry: {
  user_profile?: { name?: string | null } | null
  user_email?: string | null
  user_id?: string | null
}): string {
  if (!entry.user_profile && !entry.user_email) {
    return entry.user_id ? `Deleted User (${entry.user_id.slice(0, 6)})` : "Deleted User"
  }
  return (
    entry.user_profile?.name ||
    entry.user_email ||
    (entry.user_id ? `User ${entry.user_id.slice(0, 6)}` : "Unknown User")
  )
}

/**
 * Checks if a date falls within a given range (inclusive).
 *
 * @param date - The date to check
 * @param range - The range to check against
 * @returns True if date is within range, false otherwise
 */
export function isDateInRange(date: Date, range: Range): boolean {
  return date >= range.start && date <= range.end
}
