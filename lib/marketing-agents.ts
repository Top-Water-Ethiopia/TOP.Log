export const MARKETING_DEPARTMENT_NAME = "Marketing"
export const SALES_PROMOTER_PROFESSION_KEY = "sales-promoter"
export const LEGACY_SALES_PROMOTER_PROFESSION_KEY = "sales_promoter"
export const SALES_PROMOTER_PROFESSION_LABEL = "Sales Promoter"
export const ASSIGNED_AGENTS_OPTION_SOURCE_KIND = "assigned_agents"

export type EntryKind = "standard" | "agent_call"

export type QuestionOptionSource =
  | {
      kind: typeof ASSIGNED_AGENTS_OPTION_SOURCE_KIND
    }

export type MarketingAgentSnapshot = {
  name: string
  location: string | null
  phone: string | null
}

export type AssignedAgentOption = {
  id: string
  name: string
  location: string | null
  phone: string | null
  alreadyReported: boolean
}

export type AgentResponseValue = {
  value: string
  label: string
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function isMarketingDepartmentName(name: unknown): boolean {
  const normalized = getNonEmptyString(name)?.toLowerCase()
  return normalized === MARKETING_DEPARTMENT_NAME.toLowerCase()
}

export function normalizeSalesPromoterProfessionKey(key: unknown): string | null {
  const normalized = getNonEmptyString(key)
  if (!normalized) return null

  if (
    normalized === SALES_PROMOTER_PROFESSION_KEY ||
    normalized === LEGACY_SALES_PROMOTER_PROFESSION_KEY
  ) {
    return SALES_PROMOTER_PROFESSION_KEY
  }

  return normalized
}

export function isSalesPromoterProfessionKey(key: unknown): boolean {
  return normalizeSalesPromoterProfessionKey(key) === SALES_PROMOTER_PROFESSION_KEY
}

export function getQuestionOptionSource(metadata: unknown): QuestionOptionSource | null {
  if (typeof metadata !== "object" || metadata === null) return null

  const optionSource = (metadata as { option_source?: unknown }).option_source
  if (typeof optionSource !== "object" || optionSource === null) return null

  const kind = getNonEmptyString((optionSource as { kind?: unknown }).kind)
  if (kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND) {
    return { kind }
  }

  return null
}

export function isAssignedAgentsQuestion(question: {
  question_type?: unknown
  metadata?: unknown
}): boolean {
  return getNonEmptyString(question.question_type) === "select" &&
    getQuestionOptionSource(question.metadata)?.kind === ASSIGNED_AGENTS_OPTION_SOURCE_KIND
}

export function parseAgentResponseValue(value: unknown): AgentResponseValue | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? { value: trimmed, label: trimmed } : null
  }

  if (typeof value !== "object" || value === null) return null

  const parsedValue = getNonEmptyString((value as { value?: unknown }).value)
  const parsedLabel = getNonEmptyString((value as { label?: unknown }).label)

  if (!parsedValue) return null

  return {
    value: parsedValue,
    label: parsedLabel || parsedValue,
  }
}

export function getAgentSnapshotName(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null
  return getNonEmptyString((snapshot as { name?: unknown }).name)
}
