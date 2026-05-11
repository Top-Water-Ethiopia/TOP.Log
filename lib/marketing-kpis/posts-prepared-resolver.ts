import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type RoleQuestionRow = Database["public"]["Tables"]["role_questions"]["Row"]

export type PostsPreparedResolverWarningCode =
  | "MALFORMED_METADATA"
  | "MISSING_LEGACY_KEY"
  | "EMPTY_ENTRY_KIND"
  | "NON_IMAGE_QUESTION"
  | "DUPLICATE_PAIR"

export type PostsPreparedResolverWarning = {
  code: PostsPreparedResolverWarningCode
  questionLabel: string
  entryKind: string | null
  details?: Record<string, unknown>
}

export type ResolvedPostsPreparedPairs = {
  allowedPairsByKey: Map<string, Set<string>>
  resolvedKeys: string[]
  resolvedEntryKinds: string[]
  warnings: PostsPreparedResolverWarning[]
  stats: {
    duplicatePairsRemoved: number
    missingLegacyKey: number
    nonImageCandidates: number
    malformedMetadata: number
    emptyEntryKind: number
  }
}

function safeTrimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function getLegacyKeyFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ""
  const key = (metadata as { legacy_question_key?: unknown }).legacy_question_key
  return safeTrimString(key)
}

function buildPairId(entryKind: string, questionKey: string): string {
  return JSON.stringify([entryKind, questionKey])
}

export async function resolveConfiguredPostPreparedPairs(params: {
  supabase: SupabaseClient<Database>
  questionLabels: readonly string[]
}): Promise<ResolvedPostsPreparedPairs> {
  const warnings: PostsPreparedResolverWarning[] = []
  const stats = {
    duplicatePairsRemoved: 0,
    missingLegacyKey: 0,
    nonImageCandidates: 0,
    malformedMetadata: 0,
    emptyEntryKind: 0,
  }

  const { data, error } = await params.supabase
    .from("role_questions")
    .select("question_label, question_type, entry_kind, metadata, is_active")
    .in("question_label", [...params.questionLabels])

  if (error) {
    // Fail closed: return no pairs so KPI returns 0.
    return {
      allowedPairsByKey: new Map(),
      resolvedKeys: [],
      resolvedEntryKinds: [],
      warnings: [
        {
          code: "MALFORMED_METADATA",
          questionLabel: "unknown",
          entryKind: null,
          details: { error: error.message },
        },
      ],
      stats: { ...stats, malformedMetadata: 1 },
    }
  }

  const seen = new Set<string>()
  const allowedPairsByKey = new Map<string, Set<string>>()

  for (const row of (data || []) as Pick<RoleQuestionRow, "question_label" | "question_type" | "entry_kind" | "metadata">[]) {
    const questionLabel = safeTrimString((row as any).question_label)
    const entryKind = safeTrimString((row as any).entry_kind)
    const questionType = safeTrimString((row as any).question_type)
    const metadata = (row as any).metadata

    if (!entryKind) {
      stats.emptyEntryKind++
      warnings.push({ code: "EMPTY_ENTRY_KIND", questionLabel, entryKind: null })
      continue
    }

    if (questionType !== "image") {
      stats.nonImageCandidates++
      warnings.push({ code: "NON_IMAGE_QUESTION", questionLabel, entryKind, details: { questionType } })
      continue
    }

    const legacyKey = getLegacyKeyFromMetadata(metadata)
    if (!legacyKey) {
      // Track malformed metadata vs simply missing key.
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        stats.missingLegacyKey++
      } else {
        stats.malformedMetadata++
      }
      warnings.push({ code: "MISSING_LEGACY_KEY", questionLabel, entryKind })
      continue
    }

    const pairId = buildPairId(entryKind, legacyKey)
    if (seen.has(pairId)) {
      stats.duplicatePairsRemoved++
      warnings.push({ code: "DUPLICATE_PAIR", questionLabel, entryKind, details: { legacyKey } })
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

