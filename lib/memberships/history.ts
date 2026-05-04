export type MembershipHistoryEventKind =
  | "MEMBERSHIP_CREATED"
  | "MEMBERSHIP_ACTIVATED"
  | "MEMBERSHIP_DEACTIVATED"
  | "MEMBERSHIP_ROLE_CHANGED"
  | "MEMBERSHIP_PRIMARY_CHANGED"
  | "MEMBERSHIP_MOVED"
  | "MEMBERSHIP_DELETED"
  | "MEMBERSHIP_SYSTEM_REPAIRED_PRIMARY"
  | "MEMBERSHIP_UPDATED_GENERIC"

export type MembershipHistoryEventCategory = "lifecycle" | "role" | "system" | "metadata"
export type MembershipHistorySeverity = "high" | "medium" | "low"

export type MembershipHistorySummary = {
  status: "active" | "inactive"
  isPrimary: boolean
  role: string | null
  lastChangedAt: string | null
  lastChangedLabel: string
}

export type MembershipHistoryItem = {
  id: string
  timestamp: string | null
  timestampLabel: string
  actor: string
  actorType: "user" | "system" | "unknown"
  eventCategory: MembershipHistoryEventCategory
  eventKind: MembershipHistoryEventKind
  summary: string
  details: string[]
  severity: MembershipHistorySeverity
  debug?: {
    rawDiff: Record<string, unknown>
  }
}

export type MembershipHistoryResponse = {
  summary: MembershipHistorySummary
  events: MembershipHistoryItem[]
  nextCursor?: string
}

export type LegacyMembershipAuditEvent = {
  id: string
  action: string
  previous_role?: string | null
  new_role?: string | null
  previous_is_active?: boolean | null
  new_is_active?: boolean | null
  previous_is_primary?: boolean | null
  new_is_primary?: boolean | null
  reason?: string | null
  performed_by?: string | null
  performer_name?: string | null
  performed_at?: string | null
}

export const MEMBERSHIP_HISTORY_PAGE_SIZE = 20

export const EVENT_COPY: Record<MembershipHistoryEventKind, string> = {
  MEMBERSHIP_CREATED: "Membership created",
  MEMBERSHIP_ACTIVATED: "Membership activated",
  MEMBERSHIP_DEACTIVATED: "Membership deactivated",
  MEMBERSHIP_ROLE_CHANGED: "Role changed",
  MEMBERSHIP_PRIMARY_CHANGED: "Primary membership changed",
  MEMBERSHIP_MOVED: "Membership moved",
  MEMBERSHIP_DELETED: "Membership deleted",
  MEMBERSHIP_SYSTEM_REPAIRED_PRIMARY: "Primary membership repaired",
  MEMBERSHIP_UPDATED_GENERIC: "Membership updated",
}

const EVENT_META: Record<
  MembershipHistoryEventKind,
  { eventCategory: MembershipHistoryEventCategory; severity: MembershipHistorySeverity }
> = {
  MEMBERSHIP_CREATED: { eventCategory: "lifecycle", severity: "medium" },
  MEMBERSHIP_ACTIVATED: { eventCategory: "lifecycle", severity: "medium" },
  MEMBERSHIP_DEACTIVATED: { eventCategory: "lifecycle", severity: "high" },
  MEMBERSHIP_ROLE_CHANGED: { eventCategory: "role", severity: "medium" },
  MEMBERSHIP_PRIMARY_CHANGED: { eventCategory: "role", severity: "medium" },
  MEMBERSHIP_MOVED: { eventCategory: "role", severity: "medium" },
  MEMBERSHIP_DELETED: { eventCategory: "lifecycle", severity: "high" },
  MEMBERSHIP_SYSTEM_REPAIRED_PRIMARY: { eventCategory: "system", severity: "high" },
  MEMBERSHIP_UPDATED_GENERIC: { eventCategory: "metadata", severity: "low" },
}

type MembershipSummarySnapshot = {
  isActive: boolean
  isPrimary: boolean
  role: string | null
}

function toStatusLabel(value: boolean | null | undefined) {
  return value ? "Active" : "Inactive"
}

function toYesNoLabel(value: boolean | null | undefined) {
  return value ? "Yes" : "No"
}

function isValidIsoTimestamp(value: string | null | undefined) {
  if (!value) return false
  return !Number.isNaN(Date.parse(value))
}

function formatTimestamp(value: string | null | undefined) {
  if (!isValidIsoTimestamp(value)) {
    return { timestamp: null, timestampLabel: "Date unavailable" }
  }

  const date = new Date(value as string)
  return {
    timestamp: date.toISOString(),
    timestampLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  }
}

function getActor(event: LegacyMembershipAuditEvent) {
  if (event.action === "system_repair_primary") {
    return { actor: "System", actorType: "system" as const }
  }
  if (event.performer_name?.trim()) {
    return { actor: event.performer_name, actorType: "user" as const }
  }
  if (event.performed_by?.trim()) {
    return { actor: event.performed_by, actorType: "unknown" as const }
  }
  return { actor: "Unknown actor", actorType: "unknown" as const }
}

function inferEventKind(event: LegacyMembershipAuditEvent): MembershipHistoryEventKind {
  switch (event.action) {
    case "created":
      return "MEMBERSHIP_CREATED"
    case "activated":
    case "reactivated":
      return "MEMBERSHIP_ACTIVATED"
    case "deactivated":
      return "MEMBERSHIP_DEACTIVATED"
    case "role_changed":
      return "MEMBERSHIP_ROLE_CHANGED"
    case "primary_changed":
      return "MEMBERSHIP_PRIMARY_CHANGED"
    case "moved":
      return "MEMBERSHIP_MOVED"
    case "deleted":
    case "hard_deleted":
      return "MEMBERSHIP_DELETED"
    case "system_repair_primary":
      return "MEMBERSHIP_SYSTEM_REPAIRED_PRIMARY"
    default:
      return "MEMBERSHIP_UPDATED_GENERIC"
  }
}

function buildDetails(event: LegacyMembershipAuditEvent, eventKind: MembershipHistoryEventKind) {
  const details: string[] = []

  if (
    eventKind === "MEMBERSHIP_ROLE_CHANGED" &&
    event.previous_role !== event.new_role &&
    (event.previous_role || event.new_role)
  ) {
    details.push(`Role changed from ${event.previous_role || "None"} to ${event.new_role || "None"}`)
  }

  if (eventKind === "MEMBERSHIP_PRIMARY_CHANGED" && event.previous_is_primary !== event.new_is_primary) {
    details.push(
      `Primary changed from ${toYesNoLabel(event.previous_is_primary)} to ${toYesNoLabel(event.new_is_primary)}`
    )
  }

  if (
    eventKind === "MEMBERSHIP_UPDATED_GENERIC" &&
    event.previous_is_active !== event.new_is_active &&
    event.previous_is_active !== undefined &&
    event.new_is_active !== undefined
  ) {
    details.push(`Status changed from ${toStatusLabel(event.previous_is_active)} to ${toStatusLabel(event.new_is_active)}`)
  }

  if (event.reason?.trim()) {
    details.push(`Reason: ${event.reason.trim()}`)
  }

  return details
}

function buildSummary(eventKind: MembershipHistoryEventKind) {
  return EVENT_COPY[eventKind]
}

export function normalizeLegacyMembershipEvent(event: LegacyMembershipAuditEvent): MembershipHistoryItem {
  const eventKind = inferEventKind(event)
  const { timestamp, timestampLabel } = formatTimestamp(event.performed_at)
  const { actor, actorType } = getActor(event)
  const details = buildDetails(event, eventKind)

  return {
    id: event.id,
    timestamp,
    timestampLabel,
    actor,
    actorType,
    eventCategory: EVENT_META[eventKind].eventCategory,
    eventKind,
    summary: buildSummary(eventKind),
    details,
    severity: EVENT_META[eventKind].severity,
    debug: {
      rawDiff: {
        action: event.action,
        previous_role: event.previous_role ?? null,
        new_role: event.new_role ?? null,
        previous_is_active: event.previous_is_active ?? null,
        new_is_active: event.new_is_active ?? null,
        previous_is_primary: event.previous_is_primary ?? null,
        new_is_primary: event.new_is_primary ?? null,
      },
    },
  }
}

export function buildMembershipHistorySummary(
  snapshot: MembershipSummarySnapshot,
  latestEvent: MembershipHistoryItem | null
): MembershipHistorySummary {
  return {
    status: snapshot.isActive ? "active" : "inactive",
    isPrimary: snapshot.isPrimary,
    role: snapshot.role,
    lastChangedAt: latestEvent?.timestamp ?? null,
    lastChangedLabel: latestEvent?.timestampLabel ?? "Date unavailable",
  }
}

export function encodeMembershipHistoryCursor(timestamp: string, id: string) {
  return Buffer.from(JSON.stringify({ timestamp, id }), "utf8").toString("base64")
}

export function decodeMembershipHistoryCursor(cursor: string | null) {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as {
      timestamp?: string
      id?: string
    }
    if (!parsed.timestamp || !parsed.id) return null
    return parsed
  } catch {
    return null
  }
}
