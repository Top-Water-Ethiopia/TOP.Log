export type FormatKpiDurationResult = {
  headline: string
  isValid: boolean
}

// Keep backend values numeric (minutes). Duration formatting is presentation-only.
export function formatKpiDurationFromMinutes(minutes: unknown): FormatKpiDurationResult {
  const n = typeof minutes === "number" ? minutes : Number(minutes)
  if (!Number.isFinite(n)) return { headline: "—", isValid: false }

  // Locked algorithm:
  // 1) validate finite
  // 2) round TOTAL minutes
  // 3) derive hours/minutes
  // 4) format
  const totalMinutes = Math.max(0, Math.round(n))
  if (totalMinutes < 60) return { headline: `${totalMinutes}m`, isValid: true }

  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (mins === 0) return { headline: `${hours}h`, isValid: true }
  return { headline: `${hours}h ${mins}m`, isValid: true }
}

