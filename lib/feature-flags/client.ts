import { FEATURE_FLAGS, parseBooleanEnvValue } from "@/lib/feature-flags/flags"
import type { FeatureFlagKey } from "@/lib/feature-flags/flags"

export function isFeatureEnabledClient(flag: FeatureFlagKey): boolean {
  const raw =
    flag === "ANALYTICS"
      ? process.env.NEXT_PUBLIC_FF_ANALYTICS
      : flag === "ADMIN_NOTIFICATIONS"
        ? process.env.NEXT_PUBLIC_FF_ADMIN_NOTIFICATIONS
        : flag === "ADMIN_PERMISSIONS"
          ? process.env.NEXT_PUBLIC_FF_ADMIN_PERMISSIONS
          : flag === "REQUEST_ACCESS"
            ? process.env.NEXT_PUBLIC_FF_REQUEST_ACCESS
            : undefined
  const parsed = parseBooleanEnvValue(raw)

  if (parsed !== undefined) return parsed

  return FEATURE_FLAGS[flag].defaultValue
}
