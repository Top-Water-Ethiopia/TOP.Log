import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"

// Default colors and icons for system entry kinds
export const SYSTEM_ENTRY_KIND_DEFAULTS: Record<
  string,
  { label: string; color: string; icon: string; description: string }
> = {
  standard: {
    label: "Standard",
    color: "#6B7280", // gray
    icon: "FileText",
    description: "Default report type for general entries",
  },
  agent_call: {
    label: "Agent Call",
    color: "#3B82F6", // blue
    icon: "Phone",
    description: "Used for agent-linked reports with assigned agent dropdown",
  },
  daily_summary: {
    label: "Daily Summary",
    color: "#10B981", // green
    icon: "Calendar",
    description: "Used for once-per-day summary reports",
  },
}

// Get label for entry kind (from config or fallback to system default)
export function getEntryKindLabel(entryKind: string, config?: ScopeEntryKind | null): string {
  if (config?.label) {
    return config.label
  }

  const systemDefault = SYSTEM_ENTRY_KIND_DEFAULTS[entryKind]?.label
  if (systemDefault) {
    return systemDefault
  }

  // Fallback: Humanize the key (e.g., major_activity -> Major Activity)
  return entryKind
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Get color for entry kind (from config or fallback to system default)
export function getEntryKindColor(entryKind: string, config?: ScopeEntryKind | null): string {
  if (config?.color) {
    return config.color
  }
  return SYSTEM_ENTRY_KIND_DEFAULTS[entryKind]?.color || "#6B7280"
}

// Get icon for entry kind (from config or fallback to system default)
export function getEntryKindIcon(entryKind: string, config?: ScopeEntryKind | null): string {
  if (config?.icon) {
    return config.icon
  }
  return SYSTEM_ENTRY_KIND_DEFAULTS[entryKind]?.icon || "FileText"
}

// Get description for entry kind (from config or fallback to system default)
export function getEntryKindDescription(entryKind: string, config?: ScopeEntryKind | null): string {
  if (config?.description) {
    return config.description
  }
  return SYSTEM_ENTRY_KIND_DEFAULTS[entryKind]?.description || ""
}

// Build display label with inactive indicator
export function buildEntryKindDisplayLabel(entryKind: string, config?: ScopeEntryKind | null): string {
  const label = getEntryKindLabel(entryKind, config)
  if (config?.is_active === false) {
    return `${label} (Inactive)`
  }
  return label
}

export function getEntryKindEditorTitle(config: Pick<ScopeEntryKind, "entry_kind" | "label" | "is_active">): {
  title: string
  keyLabel: string
} {
  return {
    title: buildEntryKindDisplayLabel(config.entry_kind, config),
    keyLabel: config.entry_kind,
  }
}

// Find config for entry kind from list of configs
export function findEntryKindConfig(entryKind: string, configs: ScopeEntryKind[]): ScopeEntryKind | undefined {
  return configs.find((c) => c.entry_kind === entryKind)
}

// Get active entry kinds sorted by sort_order, then label
export function getActiveEntryKinds(configs: ScopeEntryKind[]): ScopeEntryKind[] {
  return configs
    .filter((c) => c.is_active)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.label.localeCompare(b.label)
    })
}

// Get default entry kind from configs
export function getDefaultEntryKind(configs: ScopeEntryKind[]): string {
  const active = getActiveEntryKinds(configs)
  const defaultConfig = active.find((c) => c.is_default)
  return defaultConfig?.entry_kind || active[0]?.entry_kind || "standard"
}

// Check if entry kind is available (active) in configs
export function isEntryKindAvailable(entryKind: string, configs: ScopeEntryKind[]): boolean {
  return configs.some((c) => c.entry_kind === entryKind && c.is_active)
}

// Check if entry kind supports assigned agent workflow
export function supportsAssignedAgent(entryKind: string, configs: ScopeEntryKind[]): boolean {
  return configs.some((c) => c.entry_kind === entryKind && c.supports_assigned_agent)
}

// Key format validation (shared between UI and API)
// Enforces lowercase-only machine keys to prevent case-duplicates (e.g., daily_report vs Daily_Report)
export const ENTRY_KIND_KEY_REGEX = /^[a-z0-9_]+$/
export const ENTRY_KIND_MAX_LENGTH = 50

export function isValidEntryKindKey(key: string): { valid: boolean; error?: string } {
  if (!key) return { valid: false, error: "Key is required" }
  if (key.length > ENTRY_KIND_MAX_LENGTH)
    return {
      valid: false,
      error: `Key must be ${ENTRY_KIND_MAX_LENGTH} characters or less`,
    }
  if (!ENTRY_KIND_KEY_REGEX.test(key)) {
    // Check if it's just a case issue
    if (/^[a-zA-Z0-9_]+$/.test(key) && key !== key.toLowerCase()) {
      return {
        valid: false,
        error: "Key must be lowercase only (e.g., 'daily_report' not 'Daily_Report')",
      }
    }
    return {
      valid: false,
      error: "Key must contain only lowercase letters, numbers, and underscores",
    }
  }
  return { valid: true }
}

// Normalize key to lowercase (call before saving)
export function normalizeEntryKindKey(key: string): string {
  return key.toLowerCase().trim()
}
