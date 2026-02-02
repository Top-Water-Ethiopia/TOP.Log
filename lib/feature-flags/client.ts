import { FEATURE_FLAGS, parseBooleanEnvValue } from "@/lib/feature-flags/flags"
import type { FeatureFlagKey } from "@/lib/feature-flags/flags"

export function isFeatureEnabledClient(flag: FeatureFlagKey): boolean {
  const raw =
    flag === "ANALYTICS"
      ? process.env.NEXT_PUBLIC_FF_ANALYTICS
      : flag === "SELF_SERVICE_AUTH"
        ? process.env.NEXT_PUBLIC_FF_SELF_SERVICE_AUTH
        : flag === "SEARCH"
          ? process.env.NEXT_PUBLIC_FF_SEARCH
          : flag === "DARK_MODE"
            ? process.env.NEXT_PUBLIC_FF_DARK_MODE
            : flag === "PROFILE"
              ? process.env.NEXT_PUBLIC_FF_PROFILE
              : flag === "DEPARTMENTS"
                ? process.env.NEXT_PUBLIC_FF_DEPARTMENTS
                : flag === "ADMIN_NOTIFICATIONS"
                  ? process.env.NEXT_PUBLIC_FF_ADMIN_NOTIFICATIONS
                  : flag === "ADMIN_PERMISSIONS"
                    ? process.env.NEXT_PUBLIC_FF_ADMIN_PERMISSIONS
                    : flag === "ADMIN_ROLE_AND_ACCESS"
                      ? process.env.NEXT_PUBLIC_FF_ADMIN_ROLE_AND_ACCESS
                      : flag === "ADMIN_SETTINGS"
                        ? process.env.NEXT_PUBLIC_FF_ADMIN_SETTINGS
                        : flag === "REQUEST_ACCESS"
                          ? process.env.NEXT_PUBLIC_FF_REQUEST_ACCESS
                          : undefined
  const parsed = parseBooleanEnvValue(raw)

  if (parsed !== undefined) return parsed

  return FEATURE_FLAGS[flag].defaultValue
}
