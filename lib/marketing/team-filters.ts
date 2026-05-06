export function normalizeE164(raw: string): string | null {
  const s = raw.replace(/[^\d+]/g, "")
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null
  return s
}

// For user input: allow partial E.164 prefixes (e.g. "+251911") for prefix matching.
// This is intentionally less strict than normalizeE164() which validates full E.164 numbers.
export function normalizeE164Prefix(raw: string): string | null {
  const s = raw.replace(/[^\d+]/g, "")
  if (!/^\+[1-9]\d{0,14}$/.test(s)) return null
  return s
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

export function canonicalRole(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ")
}

export function convert09ToE164IfApplicable(qDigits: string, qRaw: string): string | null {
  // Support partial local ET mobile prefix matching (digits-first; spaces/hyphens ignored):
  // - "09"                -> "+2519"
  // - "0911"              -> "+251911"
  // - "09 11 23 45 67"    -> "+251911234567"
  //
  // No upper length cap is needed here; E.164 validation happens on stored numbers.
  if (!qRaw.startsWith("+") && qDigits.startsWith("09") && qDigits.length >= 2) {
    return `+251${qDigits.slice(1)}`
  }
  return null
}

export type IndexedTeamMember = {
  userId: string
  name: string | null
  phoneVisible: boolean
  phoneRaw: string | null
  roleLabel: string
  roleKey: string
  nameKey: string
  phoneE164: string | null
  phoneDigits: string | null
}

export function indexTeamMember(input: {
  userId: string
  name: string | null
  phoneVisible: boolean
  phoneRaw: string | null
  roleLabel: string
}): IndexedTeamMember {
  const roleKey = canonicalRole(input.roleLabel)
  const nameKey = (input.name ?? "").toLocaleLowerCase()

  const phoneE164 = input.phoneVisible && input.phoneRaw ? normalizeE164(input.phoneRaw) : null
  const phoneDigits = phoneE164 ? digitsOnly(phoneE164) : null

  return {
    userId: input.userId,
    name: input.name,
    phoneVisible: input.phoneVisible,
    phoneRaw: input.phoneRaw,
    roleLabel: input.roleLabel,
    roleKey,
    nameKey,
    phoneE164,
    phoneDigits,
  }
}

export function matchesTeamSearch(params: {
  member: IndexedTeamMember
  query: string
  minPhoneDigits?: number
}): boolean {
  return evaluateTeamSearch(params).matches
}

type TokenKind = "PLUS_E164" | "LOCAL_ET" | "COUNTRY_251" | "DIGITS_SUBSTRING" | "NAME"

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ")
}

function isDigitsOnlyToken(token: string): boolean {
  const noSpaces = token.replace(/\s+/g, "")
  return /^\d+$/.test(noSpaces)
}

function classifyToken(token: string): { kind: TokenKind; token: string; digits: string; lower: string } {
  const lower = token.toLocaleLowerCase()
  const digits = digitsOnly(token)

  if (token.startsWith("+")) return { kind: "PLUS_E164", token, digits, lower }
  if (digits.startsWith("07") || digits.startsWith("09")) return { kind: "LOCAL_ET", token, digits, lower }
  if (digits.startsWith("251")) return { kind: "COUNTRY_251", token, digits, lower }
  if (isDigitsOnlyToken(token)) return { kind: "DIGITS_SUBSTRING", token, digits, lower }
  return { kind: "NAME", token, digits, lower }
}

export function evaluateTeamSearch(params: {
  member: IndexedTeamMember
  query: string
  minPhoneDigits?: number
}): { matches: boolean; score: number; hasShortDigitsToken: boolean } {
  const qRaw = normalizeQuery(params.query)
  if (!qRaw) return { matches: true, score: 0, hasShortDigitsToken: false }

  // If the query is phone-like (only digits/+/spaces/dashes), treat it as a single token
  // so "+251 911" and "09 112 345 67" are interpreted as one phone prefix.
  const isPhoneLikeQuery = /^[\d+\s-]+$/.test(qRaw)
  const tokens = (isPhoneLikeQuery ? [qRaw] : qRaw.split(" ")).filter(Boolean).map(classifyToken)
  const hasNameToken = tokens.some((t) => t.kind === "NAME")

  const minPhoneDigits = params.minPhoneDigits ?? 5

  const canPhoneMatch = params.member.phoneVisible && !!params.member.phoneE164
  const phoneE164 = params.member.phoneE164
  const phoneDigits = params.member.phoneDigits

  const tokenResults = tokens.map((t) => {
    let matched = false
    let tokenScore = 0

    const nameMatch = t.kind === "NAME" ? params.member.nameKey.includes(t.lower) : false
    if (nameMatch) {
      matched = true
      tokenScore = Math.max(tokenScore, 30)
    }

    if (canPhoneMatch && phoneE164) {
      if (t.kind === "PLUS_E164") {
        const qE164Prefix = normalizeE164Prefix(t.token)
        matched = qE164Prefix ? phoneE164.startsWith(qE164Prefix) : false
        tokenScore = matched ? Math.max(tokenScore, 100) : tokenScore
      } else if (t.kind === "LOCAL_ET") {
        // Guard: require at least 3 digits (e.g. 071, 091)
        if (t.digits.length >= 3) {
          const qE164Prefix = `+251${t.digits.slice(1)}`
          matched = phoneE164.startsWith(qE164Prefix)
          tokenScore = matched ? Math.max(tokenScore, 80) : tokenScore
        }
      } else if (t.kind === "COUNTRY_251") {
        // Country-code prefix intent: allow short prefixes (e.g. 251, 2519).
        // This can be broad, but the team list is capped (<=100) and we rank stronger matches higher.
        if (t.digits.length >= 3) {
          const qE164Prefix = `+${t.digits}`
          matched = phoneE164.startsWith(qE164Prefix)
          tokenScore = matched ? Math.max(tokenScore, 60) : tokenScore
        }
      } else if (t.kind === "DIGITS_SUBSTRING") {
        if (t.digits.length >= minPhoneDigits && phoneDigits) {
          matched = phoneDigits.includes(t.digits)
          tokenScore = matched ? Math.max(tokenScore, 40) : tokenScore
        }
      }
    }

    const isShortDigitsNoise =
      t.kind === "DIGITS_SUBSTRING" && t.digits.length > 0 && t.digits.length < minPhoneDigits

    return { matched, tokenScore, isShortDigitsNoise }
  })

  const hasShortDigitsToken = tokenResults.some((r) => r.isShortDigitsNoise)

  // AND across tokens, but allow short digit "noise" tokens (< min) to be ignored
  // when there is at least one name token (so "alice 78" still matches).
  const matches = tokenResults.every((r, idx) => {
    if (r.matched) return true
    const t = tokens[idx]
    const isIgnorableShortDigits =
      hasNameToken && t.kind === "DIGITS_SUBSTRING" && t.digits.length > 0 && t.digits.length < minPhoneDigits
    return isIgnorableShortDigits
  })

  const score = tokenResults.reduce((sum, r) => sum + r.tokenScore, 0)

  return { matches, score, hasShortDigitsToken }
}
