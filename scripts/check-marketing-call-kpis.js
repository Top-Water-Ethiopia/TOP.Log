/**
 * Compare Marketing "Calls done" vs "Number of agents contacted" directly from the database.
 *
 * Usage:
 *   node scripts/check-marketing-call-kpis.js
 *   node scripts/check-marketing-call-kpis.js 2026-05-07
 *
 * Defaults to yesterday in Africa/Addis_Ababa (EAT), matching the dashboard.
 */

const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

const TIMEZONE = "Africa/Addis_Ababa"
const ENTRY_KIND = "agent_contact"
const PAGE_SIZE = 1000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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

function buildDepartmentCoalesceOrFilter(departmentId) {
  const id = String(departmentId).trim()
  return `subject_department_id.eq.${id},and(subject_department_id.is.null,department_id.eq.${id})`
}

function validateISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function fetchAllAgentContactRows(marketingDepartmentId, targetDate) {
  const supabase = createSupabaseClient()
  const allRows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("captain_log_entries")
      .select(
        "id, date, created_at, submitted_by_user_id, department_id, subject_department_id, subject_agent_id, subject_agent_snapshot"
      )
      .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId))
      .eq("entry_kind", ENTRY_KIND)
      .eq("date", targetDate)
      .order("created_at", { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch captain_log_entries: ${error.message}`)
    }

    const rows = data || []
    allRows.push(...rows)

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

function buildDuplicateSummary(rows) {
  const rowsByAgentId = new Map()

  for (const row of rows) {
    if (!row.subject_agent_id) continue
    const existing = rowsByAgentId.get(row.subject_agent_id) || []
    existing.push(row)
    rowsByAgentId.set(row.subject_agent_id, existing)
  }

  return Array.from(rowsByAgentId.entries())
    .filter(([, agentRows]) => agentRows.length > 1)
    .map(([agentId, agentRows]) => ({
      agentId,
      count: agentRows.length,
      rowIds: agentRows.map((row) => row.id),
      snapshots: agentRows.map((row) => row.subject_agent_snapshot).filter(Boolean),
    }))
    .sort((left, right) => right.count - left.count)
}

function analyzeAgentContactRows(rows) {
  const rowsWithAgentId = rows.filter((row) => !!row.subject_agent_id)
  const missingAgentIdRows = rows.filter((row) => !row.subject_agent_id)
  const distinctAgentIds = new Set(rowsWithAgentId.map((row) => row.subject_agent_id))
  const duplicateAgents = buildDuplicateSummary(rows)
  const extraLogsFromDuplicates = duplicateAgents.reduce((sum, item) => sum + (item.count - 1), 0)

  return {
    callsDone: rows.length,
    agentsContacted: distinctAgentIds.size,
    difference: rows.length - distinctAgentIds.size,
    missingAgentIdRows,
    duplicateAgents,
    extraLogsFromDuplicates,
  }
}

async function main() {
  const targetDate = process.argv[2] || getYesterdayEATISO()

  if (!validateISODate(targetDate)) {
    console.error(`Invalid date "${targetDate}". Expected YYYY-MM-DD.`)
    process.exit(1)
  }

  console.log(`Checking Marketing call KPIs for ${targetDate} (${TIMEZONE})...\n`)

  const supabase = createSupabaseClient()
  const { data: marketingDepartment, error: marketingDepartmentError } = await supabase
    .from("departments")
    .select("id, name, slug")
    .eq("slug", "marketing")
    .maybeSingle()

  if (marketingDepartmentError) {
    throw new Error(`Failed to load Marketing department: ${marketingDepartmentError.message}`)
  }

  if (!marketingDepartment) {
    throw new Error("Marketing department not found. Expected departments.slug = 'marketing'.")
  }

  const rows = await fetchAllAgentContactRows(marketingDepartment.id, targetDate)
  const analysis = analyzeAgentContactRows(rows)

  console.log(`Department: ${marketingDepartment.name} (${marketingDepartment.id})`)
  console.log(`Entry kind: ${ENTRY_KIND}\n`)

  console.log("Dashboard-equivalent numbers")
  console.log(`- Calls done: ${analysis.callsDone}`)
  console.log(`- Number of agents contacted: ${analysis.agentsContacted}`)
  console.log(`- Difference: ${analysis.difference}\n`)

  console.log("Why they differ")
  console.log(`- Rows missing subject_agent_id: ${analysis.missingAgentIdRows.length}`)
  console.log(`- Agents with duplicate logs: ${analysis.duplicateAgents.length}`)
  console.log(`- Extra logs caused by duplicates: ${analysis.extraLogsFromDuplicates}\n`)

  if (analysis.missingAgentIdRows.length > 0) {
    console.log("Rows missing subject_agent_id")
    for (const row of analysis.missingAgentIdRows.slice(0, 20)) {
      console.log(
        `- entry_id=${row.id} created_at=${row.created_at || "n/a"} submitted_by=${row.submitted_by_user_id || "n/a"}`
      )
    }
    if (analysis.missingAgentIdRows.length > 20) {
      console.log(`- ...and ${analysis.missingAgentIdRows.length - 20} more`)
    }
    console.log("")
  }

  if (analysis.duplicateAgents.length > 0) {
    console.log("Agents with more than one log")
    for (const item of analysis.duplicateAgents.slice(0, 20)) {
      const snapshotPreview = item.snapshots[0] ? ` snapshot=${JSON.stringify(item.snapshots[0])}` : ""
      console.log(`- agent_id=${item.agentId} logs=${item.count} row_ids=${item.rowIds.join(",")}${snapshotPreview}`)
    }
    if (analysis.duplicateAgents.length > 20) {
      console.log(`- ...and ${analysis.duplicateAgents.length - 20} more`)
    }
    console.log("")
  }

  if (analysis.callsDone === analysis.agentsContacted && analysis.missingAgentIdRows.length === 0) {
    console.log("No mismatch found for this date. The two dashboard numbers should match.")
  }
}

module.exports = {
  analyzeAgentContactRows,
  buildDepartmentCoalesceOrFilter,
  buildDuplicateSummary,
  formatEATDateParts,
  getYesterdayEATISO,
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
