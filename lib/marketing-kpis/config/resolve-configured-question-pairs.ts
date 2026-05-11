import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type RoleQuestionRow = Database["public"]["Tables"]["role_questions"]["Row"]

export type ResolverWarningCode =
  | "QUERY_FAILED"
  | "MALFORMED_METADATA"
  | "MISSING_LEGACY_KEY"
  | "EMPTY_ENTRY_KIND"
  | "NON_MATCHING_TYPE"
  | "DUPLICATE_PAIR"

export type ResolverWarning = {
  code: ResolverWarningCode
  questionKey: string
  questionLabel?: string
  entryKind?: string | null
  details?: Record<string, unknown>
}

export type ResolvedQuestionPairs = {
  allowedPairsByKey: Map<string, Set<string>>
  resolvedKeys: string[]
  resolvedEntryKinds: string[]
  warnings: ResolverWarning[]
  stats: {
    duplicatePairsRemoved: number
    missingLegacyKey: number
    nonMatchingType: number
    malformedMetadata: number
    emptyEntryKind: number
  }
}

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function getLegacyKey(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ""
  return safeTrim((metadata as any).legacy_question_key)
}

function buildPairId(entryKind: string, questionKey: string): string {
  return JSON.stringify([entryKind, questionKey])
}

/**
 * Resolves configured question pairs (entry_kind, question_key) from role_questions,
 * using metadata.legacy_question_key as the stable key source (schema seam).
 *
 * Includes inactive rows for historical fidelity.
 */
export async function resolveConfiguredQuestionPairs(params: {
  supabase: SupabaseClient<Database>
  questionKeys: readonly string[]
  expectedQuestionType: string
}): Promise<ResolvedQuestionPairs> {
  const warnings: ResolverWarning[] = []
  const stats = {
    duplicatePairsRemoved: 0,
    missingLegacyKey: 0,
    nonMatchingType: 0,
    malformedMetadata: 0,
    emptyEntryKind: 0,
  }

  const requestedKeys = params.questionKeys.map((k) => k.trim()).filter(Boolean)
  if (requestedKeys.length === 0) {
    return { allowedPairsByKey: new Map(), resolvedKeys: [], resolvedEntryKinds: [], warnings, stats }
  }

  // PostgREST doesn't support json-path equality via the typed client nicely; use `.or(...)` filter.
  const orFilter = requestedKeys.map((k) => `metadata->>legacy_question_key.eq.${k}`).join(",")

  const { data, error } = await params.supabase
    .from("role_questions")
    .select("question_label, question_type, entry_kind, metadata, is_active")
    .or(orFilter)

  if (error) {
    warnings.push({ code: "QUERY_FAILED", questionKey: requestedKeys[0] || "unknown", details: { error: error.message } })
    stats.malformedMetadata++
    return { allowedPairsByKey: new Map(), resolvedKeys: [], resolvedEntryKinds: [], warnings, stats }
  }

  const allowedPairsByKey = new Map<string, Set<string>>()
  const seen = new Set<string>()

  for (const row of (data || []) as Pick<RoleQuestionRow, "question_label" | "question_type" | "entry_kind" | "metadata">[]) {
    const entryKind = safeTrim((row as any).entry_kind)
    const questionType = safeTrim((row as any).question_type)
    const questionLabel = safeTrim((row as any).question_label)
    const legacyKey = getLegacyKey((row as any).metadata)

    if (!entryKind) {
      stats.emptyEntryKind++
      warnings.push({ code: "EMPTY_ENTRY_KIND", questionKey: legacyKey || "unknown", questionLabel, entryKind: null })
      continue
    }

    if (!legacyKey) {
      const metadata = (row as any).metadata
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) stats.missingLegacyKey++
      else stats.malformedMetadata++
      warnings.push({ code: "MISSING_LEGACY_KEY", questionKey: "unknown", questionLabel, entryKind })
      continue
    }

    if (questionType !== params.expectedQuestionType) {
      stats.nonMatchingType++
      warnings.push({
        code: "NON_MATCHING_TYPE",
        questionKey: legacyKey,
        questionLabel,
        entryKind,
        details: { questionType, expected: params.expectedQuestionType },
      })
      continue
    }

    const pairId = buildPairId(entryKind, legacyKey)
    if (seen.has(pairId)) {
      stats.duplicatePairsRemoved++
      warnings.push({ code: "DUPLICATE_PAIR", questionKey: legacyKey, questionLabel, entryKind })
      continue
    }
    seen.add(pairId)

    const kinds = allowedPairsByKey.get(legacyKey) || new Set<string>()
    kinds.add(entryKind)
    allowedPairsByKey.set(legacyKey, kinds)
  }

  const resolvedKeys = Array.from(allowedPairsByKey.keys())
  const resolvedEntryKinds = Array.from(new Set(Array.from(allowedPairsByKey.values()).flatMap((set) => Array.from(set))))

  return { allowedPairsByKey, resolvedKeys, resolvedEntryKinds, warnings, stats }
}

