export type FormatKpiNumberOptions = {
  maximumFractionDigits?: number
  minimumFractionDigits?: number
}

const DEFAULT_OPTIONS: Required<FormatKpiNumberOptions> = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
}

// KPI number formatting is presentation-only. Keep API values numeric.
// Pinned locale avoids env/CI drift in separators/decimals.
const KPI_NUMBER_LOCALE = "en-US"

export function formatKpiNumber(value: unknown, options: FormatKpiNumberOptions = {}): string {
  const merged = { ...DEFAULT_OPTIONS, ...options }
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return "—"

  return new Intl.NumberFormat(KPI_NUMBER_LOCALE, {
    maximumFractionDigits: merged.maximumFractionDigits,
    minimumFractionDigits: merged.minimumFractionDigits,
  }).format(n)
}

