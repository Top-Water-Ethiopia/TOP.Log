import crypto from "crypto"
import type { TimeWindow, TimeWindowPreset } from "./types"

const TIMEZONE = "Africa/Addis_Ababa" as const
const WINDOW_HASH_VERSION = "v1"

export type TimeWindowErrorCode =
  | "AMBIGUOUS_QUERY"
  | "INVALID_DATE"
  | "PARTIAL_RANGE"
  | "FUTURE_DATE"
  | "INVERTED_RANGE"
  | "RANGE_TOO_LARGE"

export class TimeWindowError extends Error {
  code: TimeWindowErrorCode
  maxLiveDays?: number
  maxDays?: number
  suggestedPreset?: Exclude<TimeWindowPreset, "custom">

  constructor(
    code: TimeWindowErrorCode,
    message: string,
    meta?: { maxLiveDays?: number; maxDays?: number; suggestedPreset?: Exclude<TimeWindowPreset, "custom"> }
  ) {
    super(message)
    this.code = code
    this.maxLiveDays = meta?.maxLiveDays
    this.maxDays = meta?.maxDays
    this.suggestedPreset = meta?.suggestedPreset
  }
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function formatISODateFromParts(year: string, month: string, day: string) {
  return `${year}-${month}-${day}`
}

export function getTodayEATISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const year = parts.find((p) => p.type === "year")?.value || "1970"
  const month = parts.find((p) => p.type === "month")?.value || "01"
  const day = parts.find((p) => p.type === "day")?.value || "01"
  return formatISODateFromParts(year, month, day)
}

function addDaysISO(iso: string, deltaDays: number) {
  // iso is YYYY-MM-DD. Convert to UTC midnight and add days; the resulting ISO string is used purely as a date label.
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0")
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getMonthToDateWindow(today: string) {
  const first = `${today.slice(0, 7)}-01`
  return { start: first, end: today }
}

function diffDaysInclusive(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`).getTime()
  const e = new Date(`${end}T00:00:00Z`).getTime()
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
}

export function resolveTimeWindowFromQuery(params: {
  preset?: string | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  now?: Date
  maxDays: number
  liveMaxDays: number
}): { window: Omit<TimeWindow, "hash">; start: string; end: string } {
  const presetRaw = (params.preset || "").trim().toLowerCase()
  const date = (params.date || "").trim()
  const dateFrom = (params.dateFrom || "").trim()
  const dateTo = (params.dateTo || "").trim()

  const hasPreset = presetRaw.length > 0
  const hasDate = date.length > 0
  const hasRange = dateFrom.length > 0 || dateTo.length > 0

  const modeCount = Number(hasPreset) + Number(hasDate) + Number(hasRange)
  if (modeCount > 1) {
    throw new TimeWindowError("AMBIGUOUS_QUERY", "Provide exactly one of preset, date, or dateFrom+dateTo.")
  }

  const today = getTodayEATISO(params.now)
  const timezone = TIMEZONE

  let start: string
  let end: string
  let preset: TimeWindowPreset

  if (hasPreset) {
    const p = presetRaw as TimeWindowPreset
    if (!["today", "yesterday", "last7", "thismonth"].includes(presetRaw)) {
      throw new TimeWindowError("AMBIGUOUS_QUERY", "Invalid preset.")
    }

    if (presetRaw === "thismonth") {
      preset = "thisMonth"
      ;({ start, end } = getMonthToDateWindow(today))
    } else if (presetRaw === "today") {
      preset = "today"
      start = today
      end = today
    } else if (presetRaw === "yesterday") {
      preset = "yesterday"
      start = addDaysISO(today, -1)
      end = start
    } else {
      // last7 inclusive: today-6 .. today
      preset = "last7"
      start = addDaysISO(today, -6)
      end = today
    }
  } else if (hasDate) {
    if (!isValidISODate(date)) throw new TimeWindowError("INVALID_DATE", "Invalid date. Expected YYYY-MM-DD.")
    if (date > today) throw new TimeWindowError("FUTURE_DATE", "Date cannot be in the future.")
    preset = "custom"
    start = date
    end = date
  } else if (hasRange) {
    if (!dateFrom || !dateTo) throw new TimeWindowError("PARTIAL_RANGE", "Provide both dateFrom and dateTo.")
    if (!isValidISODate(dateFrom) || !isValidISODate(dateTo)) {
      throw new TimeWindowError("INVALID_DATE", "Invalid date range. Expected YYYY-MM-DD.")
    }
    if (dateTo > today) throw new TimeWindowError("FUTURE_DATE", "dateTo cannot be in the future.")
    if (dateFrom > dateTo) throw new TimeWindowError("INVERTED_RANGE", "Start date must be before end date.")
    preset = "custom"
    start = dateFrom
    end = dateTo
  } else {
    // default: yesterday
    preset = "yesterday"
    start = addDaysISO(today, -1)
    end = start
  }

  const days = diffDaysInclusive(start, end)
  if (days > params.maxDays) {
    throw new TimeWindowError("RANGE_TOO_LARGE", `Select a range of ${params.maxDays} days or less.`, {
      maxDays: params.maxDays,
      suggestedPreset: "last7",
    })
  }
  if (days > params.liveMaxDays) {
    throw new TimeWindowError("RANGE_TOO_LARGE", `Select a range of ${params.liveMaxDays} days or less.`, {
      maxLiveDays: params.liveMaxDays,
      suggestedPreset: "last7",
    })
  }

  const key = `${start}:${end}`
  const window = { start, end, preset, timezone, key }
  return { window, start, end }
}

export function buildWindowHash(params: { start: string; end: string; departmentId: string }) {
  // Version policy: bump WINDOW_HASH_VERSION if and only if window semantics change
  // (timezone, inclusivity rules, or preset boundary definitions).
  const input = `${WINDOW_HASH_VERSION}|${params.start}|${params.end}|${params.departmentId}`
  return sha256Hex(input)
}

