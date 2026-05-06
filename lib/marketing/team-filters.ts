export function normalizeE164(raw: string): string | null {
  const s = raw.replace(/[^\d+]/g, "")
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null
  return s
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

export function canonicalRole(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ")
}

export function convert09ToE164IfApplicable(qDigits: string, qRaw: string): string | null {
  // Support partial local ET mobile prefix matching:
  // - "09"        -> "+2519"
  // - "0911"      -> "+251911"
  // - "0911234567"-> "+251911234567"
  if (!qRaw.startsWith("+") && qDigits.startsWith("09") && qDigits.length >= 2 && qDigits.length <= 10) {
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
  phoneDigits: string
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
  const phoneDigits = phoneE164 ? digitsOnly(phoneE164) : ""

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
  const qRaw = params.query.trim()
  if (!qRaw) return true

  const qName = qRaw.toLocaleLowerCase()
  const qDigits = digitsOnly(qRaw)
  const qE164 = qRaw.startsWith("+") ? normalizeE164(qRaw) : convert09ToE164IfApplicable(qDigits, qRaw)

  const nameMatch = params.member.nameKey.includes(qName)

  const minPhoneDigits = params.minPhoneDigits ?? 5
  const phoneMatch =
    params.member.phoneVisible &&
    !!params.member.phoneE164 &&
    ((!!qE164 && params.member.phoneE164.startsWith(qE164)) ||
      (!qE164 && qDigits.length >= minPhoneDigits && params.member.phoneDigits.includes(qDigits)))

  return nameMatch || phoneMatch
}
