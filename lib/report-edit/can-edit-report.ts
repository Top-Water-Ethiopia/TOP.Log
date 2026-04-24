/**
 * Edit reason types for report editability checks
 * Exported for reuse across API, frontend, and tests
 */
export type EditReason =
  | "NO_SNAPSHOT"
  | "DISABLED"
  | "NOT_AVAILABLE"
  | "WINDOW_EXPIRED"
  | "NOT_OWNER"

/**
 * Result of editability check
 */
export interface CanEditReportResult {
  can_edit: boolean
  edit_reason: EditReason | null
  edit_expires_at: string | null
}

/**
 * Report metadata needed for editability check
 */
export interface ReportEditMetadata {
  entry_date: string | null
  edit_window_days_applied: number | null
  is_editable_applied: boolean
  questions_snapshot: unknown[] | null
  submitted_by_user_id: string | null
}

/**
 * Helper: Get end of day UTC for a given date (23:59:59.999)
 * This avoids off-by-one errors by using .999 milliseconds
 */
function endOfDayUTC(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  result.setUTCHours(23, 59, 59, 999)
  return result
}

/**
 * Helper: Add days to a date and get end of day UTC
 */
function addDaysEndOfDayUTC(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return endOfDayUTC(result)
}

/**
 * Check if a report can be edited
 *
 * Priority order for edit reasons:
 * 1. NO_SNAPSHOT - structural blocker
 * 2. DISABLED / NOT_AVAILABLE - policy blocker
 * 3. WINDOW_EXPIRED - time constraint
 * 4. NOT_OWNER - user-specific
 *
 * @param report - Report metadata
 * @param userId - Current user ID
 * @param now - Current time (injectable for testing, defaults to new Date())
 * @returns Editability result with reason and expiration time
 */
export function canEditReport(
  report: ReportEditMetadata,
  userId: string,
  now: Date = new Date()
): CanEditReportResult {
  // 1. NO_SNAPSHOT (highest priority - structural blocker)
  if (!report.questions_snapshot || !Array.isArray(report.questions_snapshot) || report.questions_snapshot.length === 0) {
    return {
      can_edit: false,
      edit_reason: "NO_SNAPSHOT",
      edit_expires_at: null,
    }
  }

  // 2. DISABLED / NOT_AVAILABLE (policy blocker)
  if (!report.is_editable_applied) {
    return {
      can_edit: false,
      edit_reason: "DISABLED",
      edit_expires_at: null,
    }
  }

  // 3. WINDOW_EXPIRED (time constraint)
  const windowDays = report.edit_window_days_applied ?? 2

  // Guard against negative or null window values
  if (!windowDays || windowDays <= 0) {
    return {
      can_edit: false,
      edit_reason: "WINDOW_EXPIRED",
      edit_expires_at: null,
    }
  }

  if (report.entry_date) {
    try {
      const entryDate = new Date(report.entry_date)
      const deadline = addDaysEndOfDayUTC(entryDate, windowDays)
      const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

      if (nowUtc.getTime() > deadline.getTime()) {
        return {
          can_edit: false,
          edit_reason: "WINDOW_EXPIRED",
          edit_expires_at: deadline.toISOString(),
        }
      }

      // Window is still valid - return expiration time
      return {
        can_edit: true,
        edit_reason: null,
        edit_expires_at: deadline.toISOString(),
      }
    } catch {
      // Invalid date format - treat as expired
      return {
        can_edit: false,
        edit_reason: "WINDOW_EXPIRED",
        edit_expires_at: null,
      }
    }
  }

  // No entry date - treat as expired
  return {
    can_edit: false,
    edit_reason: "WINDOW_EXPIRED",
    edit_expires_at: null,
  }

  // 4. NOT_OWNER (user-specific)
  // Note: Ownership check is handled separately in API route for now
  // This can be added here if we want to centralize all logic
}
