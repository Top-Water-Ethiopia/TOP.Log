"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { getEntryKindLabel } from "@/lib/entry-kinds"
import { useScopeEntryKinds, type ScopeEntryKind } from "@/hooks/use-entry-kinds"
import useSWR from "swr"
import { usePathname } from "next/navigation"

type AvailableEntryKindsMeta = {
  configured_default?: string | null
  effective_default?: string | null
  default_missing?: boolean
  suggested_default?: string | null
}

type AvailableEntryKindsResponse =
  | { data: any[]; meta?: AvailableEntryKindsMeta }
  | { error: string; code?: string; meta?: AvailableEntryKindsMeta }

interface EntryKindDropdownProps {
  departmentId: string
  role?: string | null
  date?: string | null
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  disabled?: boolean
}

export function EntryKindDropdown({
  departmentId,
  role,
  date,
  value,
  onChange,
  label = "Report Type",
  disabled = false,
}: EntryKindDropdownProps) {
  const pathname = usePathname()
  const hideDefaultMissingNotice =
    typeof pathname === "string" && (pathname.startsWith("/logs/news") || pathname.startsWith("/logs/new"))
  const hasAutoSelected = useRef(false)
  const lastInvalidHandledRef = useRef<string | null>(null)
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null)

  // Stable callback reference
  const stableOnChange = useCallback(onChange, [onChange])

  // Fetch entry kinds from the scope configuration
  const { entryKinds, isLoading: isLoadingConfigs } = useScopeEntryKinds(departmentId || null, role || null)

  // Fetch available entry kinds based on questions configuration
  const availableKindsUrl =
    departmentId && date
      ? `/api/reporting/available-entry-kinds?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(
          date
        )}${role ? `&role=${encodeURIComponent(role)}` : ""}`
      : null

  const { data: availableKindsData, isLoading: isChecking } = useSWR(
    availableKindsUrl,
    async (url: string) => {
      const res = await fetch(url, { credentials: "include" })
      const json = (await res.json().catch(() => null)) as AvailableEntryKindsResponse | null

      if (!res.ok) {
        // Prefer typed backend errors when provided; fall back to a generic message.
        if (json && typeof json === "object" && "error" in json && typeof json.error === "string") {
          return json
        }
        return { error: "Failed to fetch available report types." }
      }

      return (json ?? { data: [] }) as AvailableEntryKindsResponse
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  const availableMeta: AvailableEntryKindsMeta | null =
    availableKindsData && typeof availableKindsData === "object" && "meta" in availableKindsData
      ? (availableKindsData.meta ?? null)
      : null

  // Filter entry kinds based on enriched metadata and reachability from the new API
  const availableKinds = useMemo(() => {
    const kinds =
      availableKindsData && typeof availableKindsData === "object" && "data" in availableKindsData
        ? ((availableKindsData.data || []) as ScopeEntryKind[])
        : ([] as ScopeEntryKind[])
    const scopedConfigs = new Map(entryKinds.map((kind) => [kind.entry_kind, kind]))
    // Deduplicate by entry_kind to prevent React key warnings
    const seen = new Set<string>()
    return kinds
      .filter((k) => {
        if (seen.has(k.entry_kind)) return false
        seen.add(k.entry_kind)
        return true
      })
      .map((kind) => {
        const scopedConfig = scopedConfigs.get(kind.entry_kind)
        return scopedConfig
          ? {
              ...kind,
              label: scopedConfig.label || kind.label,
              color: scopedConfig.color || kind.color,
              icon: scopedConfig.icon || kind.icon,
              description: scopedConfig.description || kind.description,
              is_default: scopedConfig.is_default ?? kind.is_default,
              supports_assigned_agent: scopedConfig.supports_assigned_agent ?? kind.supports_assigned_agent,
            }
          : kind
      })
  }, [availableKindsData, entryKinds])

  // If no value is selected, prefer the effective default from the API (date-aware),
  // so the dropdown doesn't implicitly fall back to "standard" when it's unavailable.
  useEffect(() => {
    if (value || hasAutoSelected.current) return
    const effectiveDefault = availableMeta?.effective_default
    if (!effectiveDefault) return
    if (!availableKinds.some((k) => k.entry_kind === effectiveDefault)) return
    hasAutoSelected.current = true
    stableOnChange(effectiveDefault)
  }, [availableKinds, availableMeta?.effective_default, stableOnChange, value])

  // If a previously selected entry kind becomes invalid when the date changes,
  // reset to the API-provided effective default (or clear) and show a specific notice.
  useEffect(() => {
    if (!date) return
    if (!value) return
    if (availableKinds.some((k) => k.entry_kind === value)) {
      setSelectionNotice(null)
      return
    }

    const effectiveDefault = availableMeta?.effective_default ?? null
    const nextValue =
      effectiveDefault && availableKinds.some((k) => k.entry_kind === effectiveDefault) ? effectiveDefault : null

    const handledKey = `${date}|${value}|${nextValue ?? ""}`
    if (lastInvalidHandledRef.current === handledKey) {
      return
    }
    lastInvalidHandledRef.current = handledKey

    if (nextValue === value) {
      return
    }

    setSelectionNotice(
      nextValue
        ? `"${value}" isn’t available on ${date}. Selecting "${nextValue}".`
        : `"${value}" isn’t available on ${date}. Select a different report type or date.`
    )

    hasAutoSelected.current = true
    stableOnChange(nextValue)
  }, [availableKinds, availableMeta?.effective_default, date, stableOnChange, value])

  // Auto-select if only one type available and no value selected
  useEffect(() => {
    if (availableKinds.length === 1 && !value && !hasAutoSelected.current) {
      hasAutoSelected.current = true
      stableOnChange(availableKinds[0].entry_kind)
    }
  }, [availableKinds, value, stableOnChange])

  useEffect(() => {
    if (departmentId) {
      hasAutoSelected.current = false
    }
  }, [departmentId])

  const isLoading = isChecking || isLoadingConfigs

  if (!date) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          Select a date to see available report types.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex h-10 items-center gap-2 rounded-md border px-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading report types...</span>
        </div>
      </div>
    )
  }

  if (availableKinds.length === 0) {
    const errorMessage =
      availableKindsData && typeof availableKindsData === "object" && "error" in availableKindsData
        ? availableKindsData.error
        : null

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          {errorMessage || "No report types available for your role in this department."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="entry-kind-select">{label}</Label>
      <Select
        value={value || ""}
        onValueChange={(newValue) => onChange(newValue)}
        disabled={disabled || availableKinds.length <= 1}
      >
        <SelectTrigger id="entry-kind-select" className="w-full">
          <SelectValue placeholder="Select report type" />
        </SelectTrigger>
        <SelectContent>
          {availableKinds.map((kind: ScopeEntryKind) => (
            <SelectItem key={kind.entry_kind} value={kind.entry_kind}>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: kind.color || "#6B7280" }} />
                <span>{kind.label || getEntryKindLabel(kind.entry_kind)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!hideDefaultMissingNotice && availableMeta?.default_missing && availableMeta?.suggested_default ? (
        <p className="text-muted-foreground text-xs">
          Default report type isn’t available for this date. Selecting{" "}
          <span className="font-medium">{availableMeta.suggested_default}</span>.
        </p>
      ) : null}
      {selectionNotice ? <p className="text-muted-foreground text-xs">{selectionNotice}</p> : null}
    </div>
  )
}
