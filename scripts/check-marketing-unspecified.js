/**
 * Find "unspecified" data for Marketing agent contacts directly from the database.
 *
 * This script is meant to explain why dashboard numbers can look "off" by counting:
 * - agent_contact entries missing subject_agent_id (can't be counted as a contacted agent)
 * - entries missing contact_success (outcome is "missing")
 * - failed entries missing failure_reason (failure reasons show as "unspecified")
 * - entries missing complaints answer
 *
 * Usage:
 *   node scripts/check-marketing-unspecified.js
 *   node scripts/check-marketing-unspecified.js 2026-05-07
 */

const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

const TIMEZONE = "Africa/Addis_Ababa"
const ENTRY_KIND = "agent_contact"
const PAGE_SIZE = 1000

const QUESTION_KEYS = {
  CONTACT_SUCCESS: "were_you_able_to_reach_the_agent",
  FAILURE_REASON: "why_was_the_contact_unsuccessful",
  COMPLAINTS: "are_there_any_complaints_from_agent",
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function formatEATDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value || "1970"
  const month = parts.find((part) => part.type === "month")?.value || "01"
  const day = parts.find((part) => part.type === "day")?.value || "01"
  return `${year}-${month}-${day}`
}

function addDaysISO(isoDate, deltaDays) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0")
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getYesterdayEATISO() {
  return addDaysISO(formatEATDateParts(new Date()), -1)
}

function validateISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function buildDepartmentCoalesceOrFilter(departmentId) {
  const id = String(departmentId).trim()
  return `subject_department_id.eq.${id},and(subject_department_id.is.null,department_id.eq.${id})`
}

function parseJsonbString(value) {
  // Many custom_responses values are JSONB strings like '"Yes"'
  if (typeof value !== "string") return value
  return value.replace(/^\"|\"$/g, "")
}

function classifyOutcome(parsedSuccess) {
  const v = typeof parsedSuccess === "string" ? parsedSuccess.trim().toLowerCase() : parsedSuccess
  if (v === "yes" || v === true) return "success"
  if (v === "no" || v === false) return "failed"
  return "missing"
}

async function fetchAllAgentContactEntriesForDate({ supabase, marketingDepartmentId, targetDate }) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("captain_log_entries")
      .select("id, created_at, submitted_by_user_id, subject_agent_id")
      .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId))
      .eq("entry_kind", ENTRY_KIND)
      .eq("date", targetDate)
      .order("created_at", { ascending: true })
      .range(from, to)

    if (error) throw new Error(`Failed to fetch captain_log_entries: ${error.message}`)
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function fetchCustomResponsesForDate({ supabase, marketingDepartmentId, targetDate }) {
  const { data, error } = await supabase
    .from("custom_responses")
    .select("entry_id, question_key, value, captain_log_entries!inner(id)")
    .in("question_key", [QUESTION_KEYS.CONTACT_SUCCESS, QUESTION_KEYS.FAILURE_REASON, QUESTION_KEYS.COMPLAINTS])
    .eq("captain_log_entries.entry_kind", ENTRY_KIND)
    .eq("captain_log_entries.date", targetDate)
    .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId), { foreignTable: "captain_log_entries" })

  if (error) throw new Error(`Failed to fetch custom_responses: ${error.message}`)
  return data || []
}

function analyzeUnspecified({ entries, responses }) {
  const successByEntry = new Map()
  const failureReasonsByEntry = new Map()
  const complaintsByEntry = new Map()

  for (const row of responses) {
    const entryId = String(row.entry_id || "")
    const key = String(row.question_key || "")
    if (!entryId || !key) continue
    if (key === QUESTION_KEYS.CONTACT_SUCCESS) successByEntry.set(entryId, row.value)
    if (key === QUESTION_KEYS.FAILURE_REASON) failureReasonsByEntry.set(entryId, row.value)
    if (key === QUESTION_KEYS.COMPLAINTS) complaintsByEntry.set(entryId, row.value)
  }

  const missingSubjectAgent = []
  const missingOutcome = []
  const failedMissingReason = []
  const missingComplaints = []

  for (const e of entries) {
    const entryId = String(e.id || "")
    if (!e.subject_agent_id) missingSubjectAgent.push(entryId)

    const rawSuccess = successByEntry.get(entryId)
    const parsedSuccess = parseJsonbString(rawSuccess)
    const outcome = classifyOutcome(parsedSuccess)

    if (outcome === "missing") {
      missingOutcome.push(entryId)
    } else if (outcome === "failed") {
      const rawReasons = failureReasonsByEntry.get(entryId)
      // We only care if there is at least one reason; values can be JSON array or string.
      const hasReason =
        (Array.isArray(rawReasons) && rawReasons.length > 0) ||
        (typeof rawReasons === "string" && rawReasons.trim().length > 0 && rawReasons !== "null")
      if (!hasReason) failedMissingReason.push(entryId)
    }

    if (!complaintsByEntry.has(entryId)) {
      missingComplaints.push(entryId)
    }
  }

  return {
    totalEntries: entries.length,
    missingSubjectAgent,
    missingOutcome,
    failedMissingReason,
    missingComplaints,
  }
}

async function main() {
  const targetDate = process.argv[2] || getYesterdayEATISO()
  if (!validateISODate(targetDate)) {
    console.error(`Invalid date "${targetDate}". Expected YYYY-MM-DD.`)
    process.exit(1)
  }

  const supabase = createSupabaseClient()

  const { data: marketingDepartment, error: deptError } = await supabase
    .from("departments")
    .select("id, name, slug")
    .eq("slug", "marketing")
    .maybeSingle()

  if (deptError) throw new Error(`Failed to load Marketing department: ${deptError.message}`)
  if (!marketingDepartment) throw new Error("Marketing department not found. Expected departments.slug = 'marketing'.")

  const entries = await fetchAllAgentContactEntriesForDate({
    supabase,
    marketingDepartmentId: marketingDepartment.id,
    targetDate,
  })
  const responses = await fetchCustomResponsesForDate({
    supabase,
    marketingDepartmentId: marketingDepartment.id,
    targetDate,
  })

  const analysis = analyzeUnspecified({ entries, responses })

  console.log(`Marketing unspecified report for ${targetDate} (${TIMEZONE})`)
  console.log(`Department: ${marketingDepartment.name} (${marketingDepartment.id})`)
  console.log(`Entry kind: ${ENTRY_KIND}\n`)

  console.log("Counts")
  console.log(`- Total agent_contact entries: ${analysis.totalEntries}`)
  console.log(`- Missing subject_agent_id: ${analysis.missingSubjectAgent.length}`)
  console.log(`- Missing contact_success (outcome missing): ${analysis.missingOutcome.length}`)
  console.log(`- Failed but missing failure_reason: ${analysis.failedMissingReason.length}`)
  console.log(`- Missing complaints answer: ${analysis.missingComplaints.length}\n`)

  const preview = (label, ids) => {
    if (ids.length === 0) return
    console.log(label)
    for (const id of ids.slice(0, 20)) console.log(`- ${id}`)
    if (ids.length > 20) console.log(`- ...and ${ids.length - 20} more`)
    console.log("")
  }

  preview("Missing subject_agent_id entry_ids", analysis.missingSubjectAgent)
  preview("Missing contact_success entry_ids", analysis.missingOutcome)
  preview("Failed missing failure_reason entry_ids", analysis.failedMissingReason)
  preview("Missing complaints answer entry_ids", analysis.missingComplaints)
}

module.exports = { analyzeUnspecified }

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
