type QuestionIdentityLike = {
  id?: unknown
  key?: unknown
  question_key?: unknown
  metadata?: unknown
}

export function normalizeQuestionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

export function getLegacyQuestionKeyFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null

  const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getQuestionStorageKey(question: QuestionIdentityLike): string | null {
  if (typeof question.question_key === "string" && question.question_key.trim().length > 0) {
    return question.question_key.trim()
  }

  if (typeof question.key === "string" && question.key.trim().length > 0) {
    return question.key.trim()
  }

  const legacyKey = getLegacyQuestionKeyFromMetadata(question.metadata)
  if (legacyKey) return legacyKey

  if (typeof question.id === "string" && question.id.trim().length > 0) {
    return question.id.trim()
  }

  return null
}

export function getQuestionReactKey(question: QuestionIdentityLike, index: number): string {
  if (typeof question.id === "string" && question.id.trim().length > 0) {
    return `${question.id.trim()}-${index}`
  }

  const storageKey = getQuestionStorageKey(question)
  if (storageKey) return `${storageKey}-${index}`

  return `question-${index}`
}

export function findDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>()

  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
}
