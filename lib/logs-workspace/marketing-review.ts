import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"

export const MARKETING_REVIEW_ENTRY_KINDS = {
  agentContact: "agent_contact",
  majorActivity: "dmal",
  supervisorDailyReport: "daily_supervisors_report",
} as const

export interface LogsWorkspaceRowForSummary {
  entry_kind?: string | null
  id: string
  response_count?: number
  subject_agent_name?: string | null
}

export interface LogsWorkspaceSummary {
  operational: {
    agentContacts: number
    majorActivities: number
    supervisorDailyReports: number
    totalReports: number
  }
  quality: {
    emptyReports: number
    missingAgent: number
    unknownTypes: number
  }
}

export function formatMarketingEntryKindLabel(entryKind: string | null | undefined, configs: ScopeEntryKind[] = []) {
  const key = String(entryKind || "").trim()
  const configured = configs.find((config) => config.entry_kind === key)
  if (configured?.label) return configured.label

  const known: Record<string, string> = {
    [MARKETING_REVIEW_ENTRY_KINDS.agentContact]: "Agent contact",
    [MARKETING_REVIEW_ENTRY_KINDS.majorActivity]: "Major activity",
    [MARKETING_REVIEW_ENTRY_KINDS.supervisorDailyReport]: "Supervisor daily report",
    agent_call: "Agent call",
    standard: "Standard report",
  }
  if (known[key]) return known[key]

  return key
    ? key
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase())
    : "Unknown report"
}

export function isKnownMarketingEntryKind(entryKind: string | null | undefined, configs: ScopeEntryKind[] = []) {
  const key = String(entryKind || "").trim()
  if (!key) return false
  if (configs.some((config) => config.entry_kind === key)) return true
  return Object.values(MARKETING_REVIEW_ENTRY_KINDS).includes(key as any) || key === "agent_call" || key === "standard"
}

export function summarizeMarketingReviewRows(
  rows: LogsWorkspaceRowForSummary[],
  configs: ScopeEntryKind[] = []
): LogsWorkspaceSummary {
  const summary: LogsWorkspaceSummary = {
    operational: {
      totalReports: rows.length,
      agentContacts: 0,
      majorActivities: 0,
      supervisorDailyReports: 0,
    },
    quality: {
      emptyReports: 0,
      missingAgent: 0,
      unknownTypes: 0,
    },
  }

  rows.forEach((row) => {
    const entryKind = row.entry_kind || "standard"
    if (entryKind === MARKETING_REVIEW_ENTRY_KINDS.agentContact) summary.operational.agentContacts += 1
    if (entryKind === MARKETING_REVIEW_ENTRY_KINDS.majorActivity) summary.operational.majorActivities += 1
    if (entryKind === MARKETING_REVIEW_ENTRY_KINDS.supervisorDailyReport) summary.operational.supervisorDailyReports += 1
    if (!row.response_count || row.response_count <= 0) summary.quality.emptyReports += 1
    if (entryKind === MARKETING_REVIEW_ENTRY_KINDS.agentContact && !row.subject_agent_name) summary.quality.missingAgent += 1
    if (!isKnownMarketingEntryKind(entryKind, configs)) summary.quality.unknownTypes += 1
  })

  return summary
}

