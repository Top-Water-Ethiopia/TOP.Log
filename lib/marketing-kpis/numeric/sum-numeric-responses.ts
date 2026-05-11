export type NumericSumStats = {
  sum: number
  skipped: {
    missingKey: number
    missingEntryKind: number
    pairMismatch: number
    malformed: number
    nonFinite: number
    negative: number
  }
}

function safeTrimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseStrictNumber(value: unknown): { ok: true; value: number } | { ok: false; reason: "malformed" | "nonFinite" | "negative" } {
  let num: number | null = null

  if (typeof value === "number") {
    num = value
  } else if (typeof value === "string") {
    const s = value.trim()
    // Reject locale formatted numbers like "1,200"
    if (!s) return { ok: false, reason: "malformed" }
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return { ok: false, reason: "malformed" }
    num = Number(s)
  } else {
    return { ok: false, reason: "malformed" }
  }

  if (!Number.isFinite(num)) return { ok: false, reason: "nonFinite" }
  if (num < 0) return { ok: false, reason: "negative" }
  return { ok: true, value: num }
}

export function sumNumericResponses(params: {
  rows: any[]
  allowedPairsByKey: Map<string, Set<string>>
  getQuestionKey: (row: any) => unknown
  getEntryKind: (row: any) => unknown
  getValue: (row: any) => unknown
}): NumericSumStats {
  const stats: NumericSumStats = {
    sum: 0,
    skipped: { missingKey: 0, missingEntryKind: 0, pairMismatch: 0, malformed: 0, nonFinite: 0, negative: 0 },
  }

  for (const row of params.rows || []) {
    const key = safeTrimString(params.getQuestionKey(row))
    if (!key) {
      stats.skipped.missingKey++
      continue
    }
    const entryKind = safeTrimString(params.getEntryKind(row))
    if (!entryKind) {
      stats.skipped.missingEntryKind++
      continue
    }

    if (!params.allowedPairsByKey.get(key)?.has(entryKind)) {
      stats.skipped.pairMismatch++
      continue
    }

    const parsed = parseStrictNumber(params.getValue(row))
    if (!parsed.ok) {
      if (parsed.reason === "malformed") stats.skipped.malformed++
      if (parsed.reason === "nonFinite") stats.skipped.nonFinite++
      if (parsed.reason === "negative") stats.skipped.negative++
      continue
    }

    stats.sum += parsed.value
  }

  return stats
}

