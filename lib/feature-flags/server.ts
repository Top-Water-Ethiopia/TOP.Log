import { FEATURE_FLAGS, parseBooleanEnvValue } from "@/lib/feature-flags/flags"
import type { FeatureFlagKey } from "@/lib/feature-flags/flags"

export function isFeatureEnabledServer(flag: FeatureFlagKey): boolean {
  const envKey = `FF_${flag}`
  const raw = process.env[envKey] ?? process.env[`NEXT_PUBLIC_FF_${flag}`]
  const parsed = parseBooleanEnvValue(raw)

  if (parsed !== undefined) return parsed

  return FEATURE_FLAGS[flag].defaultValue
}
