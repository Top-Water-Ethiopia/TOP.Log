export const AGENT_CONTACT_ENTRY_KIND = "agent_contact"

export const QUESTION_KEYS = {
  CONTACT_SUCCESS: "were_you_able_to_reach_the_agent",
  FAILURE_REASON: "why_was_the_contact_unsuccessful",
} as const

export type Outcome = "success" | "failed" | "missing"

export function classifyOutcome(successValue: unknown): Outcome {
  if (typeof successValue !== "string") return "missing"
  const trimmed = successValue.trim()
  if (trimmed === "Yes") return "success"
  if (trimmed === "No") return "failed"
  return "missing"
}

export function isValidReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function normalizeReason(value: string) {
  return value.trim().toLowerCase()
}

const REASON_CANONICAL_MAP: Record<string, string> = {
  "no answer": "no_answer",
  "wrong number": "wrong_number",
  "line busy": "line_busy",
  "network issue": "network_issue",
}

export function canonicalizeReason(normalized: string) {
  return REASON_CANONICAL_MAP[normalized] || normalized.replace(/\s+/g, "_")
}

export function extractFailureReasons(value: unknown): string[] {
  // DB examples show JSON arrays: ["No answer"], ["No answer","Line busy"], etc.
  // Supabase may deserialize jsonb into JS arrays already; keep this tolerant.
  const rawArray = Array.isArray(value) ? value : null
  if (!rawArray) return []

  const normalized = rawArray
    .filter(isValidReason)
    .map((r) => canonicalizeReason(normalizeReason(r)))
    .filter((r) => r.length > 0)

  // Deduplicate per entry
  return Array.from(new Set(normalized))
}

export function computeRates(params: { success: number; failed: number; missing: number; total: number }) {
  const denom = params.success + params.failed
  const successRate = denom > 0 ? params.success / denom : 0
  const missingRate = params.total > 0 ? params.missing / params.total : 0
  return { successRate, missingRate }
}

