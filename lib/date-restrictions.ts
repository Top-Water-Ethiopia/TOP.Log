/**
 * Date Restrictions Utility
 * Implements industrial-level date validation for log entries
 *
 * Business Rules:
 * - Users can create/update entries for TODAY and the LAST 2 DAYS (total: 3 days)
 * - Users CANNOT delete any entries (data retention policy)
 * - Future dates are always blocked
 * - Dates older than 2 days ago are blocked for new entries
 */

export interface DateValidationResult {
  isValid: boolean
  error?: string
  severity?: "info" | "warning" | "error"
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Get the date N days ago from today (in YYYY-MM-DD format)
 */
export function getDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatLocalDate(date)
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  return formatLocalDate(new Date())
}

/**
 * Get the minimum allowed date for entry creation/update (2 days ago)
 */
export function getMinAllowedDate(): string {
  return getDaysAgo(2)
}

/**
 * Get the maximum allowed date for entry creation/update (today)
 */
export function getMaxAllowedDate(): string {
  return getToday()
}

/**
 * Calculate the number of days between two dates
 * Returns positive number if date1 is after date2, negative if before
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + "T00:00:00")
  const d2 = new Date(date2 + "T00:00:00")
  const diffTime = d1.getTime() - d2.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date is within the allowed range for entry creation/update
 * Allowed range: last 2 days to today (inclusive)
 */
export function isDateInAllowedRange(date: string): boolean {
  const today = getToday()
  const minDate = getMinAllowedDate()

  return date >= minDate && date <= today
}

/**
 * Validate if a date can be used for creating a new entry
 */
export function canCreateEntryForDate(date: string): DateValidationResult {
  const today = getToday()

  // Check if date is in the future
  if (date > today) {
    return {
      isValid: false,
      error: "Cannot create entries for future dates",
      severity: "error",
    }
  }

  return { isValid: true }
}

/**
 * Validate if a date can be used for updating an existing entry
 */
export function canUpdateEntryForDate(date: string, _entryCreatedAt?: string): DateValidationResult {
  void _entryCreatedAt
  const today = getToday()
  const minDate = getMinAllowedDate()

  // Check if date is in the future
  if (date > today) {
    return {
      isValid: false,
      error: "Cannot update entries to future dates",
      severity: "error",
    }
  }

  // Check if date is too old
  if (date < minDate) {
    const daysOld = daysBetween(today, date)
    return {
      isValid: false,
      error: `Cannot update entries older than 2 days. This date is ${daysOld} days old.`,
      severity: "warning",
    }
  }

  return { isValid: true }
}

/**
 * Validate if an entry can be deleted
 * As per business rules, deletion is NOT allowed
 */
export function canDeleteEntry(_entryDate: string): DateValidationResult {
  void _entryDate
  return {
    isValid: false,
    error: "Deleting entries is not allowed. Data retention policy requires all entries to be preserved.",
    severity: "error",
  }
}

/**
 * Get a user-friendly message explaining the date restrictions
 */
export function getDateRestrictionMessage(): string {
  const today = getToday()
  const minDate = getMinAllowedDate()

  return `You can create log entries for any past date (up to ${today}). You can update log entries for today and the last 2 days (${minDate} to ${today}). Entries cannot be deleted.`
}

/**
 * Get the list of allowed dates (today and last 2 days)
 * Returns array in descending order (today first)
 */
export function getAllowedDates(): string[] {
  return [getToday(), getDaysAgo(1), getDaysAgo(2)]
}

/**
 * Format a date string to a human-readable format
 */
export function formatDateHuman(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  const today = getToday()
  const yesterday = getDaysAgo(1)

  if (dateString === today) {
    return `Today (${date.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })})`
  } else if (dateString === yesterday) {
    return `Yesterday (${date.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })})`
  } else {
    return date.toLocaleDateString("default", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }
}
