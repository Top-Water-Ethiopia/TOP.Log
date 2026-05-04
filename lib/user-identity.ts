export function maskEmail(email: string): string | null {
  const trimmed = email.trim()
  const at = trimmed.indexOf("@")
  if (at <= 0) return null

  const first = trimmed[0] ?? ""
  const domain = trimmed.slice(at + 1)
  if (!first || !domain) return null

  return `${first}***@${domain}`
}

export function maskPhoneE164(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed.startsWith("+")) return null

  const digits = trimmed.slice(1).replace(/\D/g, "")
  if (digits.length < 8) return null

  const countryCode = digits.slice(0, 3)
  const nationalStart = digits.slice(3, 5)
  const last2 = digits.slice(-2)

  if (!countryCode || !last2) return null

  // Example: +251 9•• •• ••45
  return `+${countryCode} ${nationalStart.charAt(0) || ""}•• •• ••${last2}`
}

export function getDisplayLabel(opts: {
  name?: string | null
  email?: string | null
  phone?: string | null
  viewerContact?: string | null
}): string {
  const name = typeof opts.name === "string" ? opts.name.trim() : ""
  if (name) return name

  const email = typeof opts.email === "string" ? opts.email.trim() : ""
  const maskedEmail = email ? maskEmail(email) : null
  if (maskedEmail) return maskedEmail

  const phone = typeof opts.phone === "string" ? opts.phone.trim() : ""
  const maskedPhone = phone ? maskPhoneE164(phone) : null
  if (maskedPhone) return maskedPhone

  const viewerContact = typeof opts.viewerContact === "string" ? opts.viewerContact.trim() : ""
  const maskedViewerEmail = viewerContact ? maskEmail(viewerContact) : null
  if (maskedViewerEmail) return maskedViewerEmail
  const maskedViewerPhone = viewerContact ? maskPhoneE164(viewerContact) : null
  if (maskedViewerPhone) return maskedViewerPhone

  return "User"
}

export function getAvatarLabel(displayLabel: string): string {
  const match = displayLabel.match(/[A-Za-z0-9]/)
  return (match?.[0] ?? "U").toUpperCase()
}

