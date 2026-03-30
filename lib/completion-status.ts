import { createClient } from "@/lib/supabase/server"
import { getAllowedDates, formatLocalDate } from "./date-restrictions"

export interface ReportStatus {
  allowedDates: string[]
  submittedDates: string[]
  missingDates: string[]
  isFullySubmitted: boolean
}

export interface CompletionStatus {
  isComplete: boolean
  completedDates: string[]
  missingDates: string[]
  totalAllowed: number
  totalCompleted: number
  nextAvailableDate: string
  hoursUntilNextAvailable: number
}

export async function getReportStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId?: string | null
): Promise<ReportStatus> {
  const allowedDates = getAllowedDates()

  let query = supabase
    .from("captain_log_entries")
    .select("date")
    .eq("user_id", userId)
    .in("date", allowedDates)
    .order("date", { ascending: false })

  if (departmentId === null) {
    query = query.is("department_id", null)
  } else if (typeof departmentId === "string") {
    query = query.eq("department_id", departmentId)
  }

  const { data: entries, error } = await query

  if (error) {
    console.error("Error fetching entries for report status:", error)
    return {
      allowedDates,
      submittedDates: [],
      missingDates: allowedDates,
      isFullySubmitted: false,
    }
  }

  const submittedDates = [...new Set((entries || []).map((e) => normalizeEntryDate(e.date)).filter(Boolean))].filter((date) =>
    allowedDates.includes(date)
  )

  const missingDates = allowedDates.filter((date) => !submittedDates.includes(date))

  return {
    allowedDates,
    submittedDates,
    missingDates,
    isFullySubmitted: missingDates.length === 0,
  }
}

/**
 * Get completion status for a user's log entries
 * Uses server-side date for consistency
 */
export async function getCompletionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId?: string | null
): Promise<CompletionStatus> {
  const reportStatus = await getReportStatus(supabase, userId, departmentId)

  // Calculate next available date
  const nextAvailableDate = getTomorrowDate()
  const hoursUntilNextAvailable = getHoursUntilMidnight()

  return {
    isComplete: reportStatus.isFullySubmitted,
    completedDates: reportStatus.submittedDates,
    missingDates: reportStatus.missingDates,
    totalAllowed: reportStatus.allowedDates.length,
    totalCompleted: reportStatus.submittedDates.length,
    nextAvailableDate,
    hoursUntilNextAvailable,
  }
}

function normalizeEntryDate(value: unknown): string {
  if (typeof value === "string") {
    return value.split("T")[0]
  }

  return formatLocalDate(new Date(value as string | number | Date))
}

function getTomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return formatLocalDate(tomorrow)
}

function getHoursUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  return Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60))
}
