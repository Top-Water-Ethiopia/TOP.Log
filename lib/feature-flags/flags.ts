export const FEATURE_FLAGS = {
  ANALYTICS: {
    defaultValue: false,
  },
  SEARCH: {
    defaultValue: false,
  },
  DARK_MODE: {
    defaultValue: false,
  },
  PROFILE: {
    defaultValue: false,
  },
  ADMIN_NOTIFICATIONS: {
    defaultValue: false,
  },
  ADMIN_PERMISSIONS: {
    defaultValue: false,
  },
  REQUEST_ACCESS: {
    defaultValue: false,
  },
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

export function parseBooleanEnvValue(value: string | undefined): boolean | undefined {
  if (value == null) return undefined

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) return true
  if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) return false

  return undefined
}
