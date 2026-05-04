export type AuthIdentifier =
  | {
      type: "email"
      value: string
    }
  | {
      type: "phone"
      value: string
    }

const ETHIOPIAN_MOBILE_LOCAL_REGEX = /^9\d{8}$/
const ETHIOPIAN_MOBILE_E164_REGEX = /^\+2519\d{8}$/

function stripPhoneFormatting(value: string) {
  return value.replace(/[\s\-()]/g, "")
}

export function normalizeEthiopianPhone(rawValue: string): string | null {
  const value = stripPhoneFormatting(rawValue.trim())

  if (!value) return null

  if (ETHIOPIAN_MOBILE_E164_REGEX.test(value)) {
    return value
  }

  if (/^09\d{8}$/.test(value)) {
    return `+251${value.slice(1)}`
  }

  if (ETHIOPIAN_MOBILE_LOCAL_REGEX.test(value)) {
    return `+251${value}`
  }

  if (/^2519\d{8}$/.test(value)) {
    return `+${value}`
  }

  if (/^25109\d{8}$/.test(value)) {
    return `+251${value.slice(4)}`
  }

  return null
}

export function parseAuthIdentifier(rawValue: string): AuthIdentifier | null {
  const value = rawValue.trim()

  if (!value) return null

  if (value.includes("@")) {
    return {
      type: "email",
      value: value.toLowerCase(),
    }
  }

  const normalizedPhone = normalizeEthiopianPhone(value)

  if (!normalizedPhone) {
    return null
  }

  return {
    type: "phone",
    value: normalizedPhone,
  }
}

export function getAuthIdentifierError(rawValue: string) {
  if (!rawValue.trim()) {
    return "Email or phone number is required"
  }

  if (rawValue.includes("@")) {
    return "Enter a valid email address"
  }

  return "Enter a valid Ethiopian phone number"
}
