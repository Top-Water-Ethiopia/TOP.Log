"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { getEntryKindLabel } from "@/lib/entry-kinds"
import { useScopeEntryKinds, type ScopeEntryKind } from "@/hooks/use-entry-kinds"
import useSWR from "swr"

interface EntryKindDropdownProps {
  departmentId: string
  role?: string | null
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  disabled?: boolean
}

export function EntryKindDropdown({
  departmentId,
  role,
  value,
  onChange,
  label = "Report Type",
  disabled = false,
}: EntryKindDropdownProps) {
  const hasAutoSelected = useRef(false)

  // Stable callback reference
  const stableOnChange = useCallback(onChange, [onChange])

  // Fetch entry kinds from the scope configuration
  const { entryKinds, isLoading: isLoadingConfigs } = useScopeEntryKinds(departmentId || null, role || null)

  // Fetch available entry kinds based on questions configuration
  const availableKindsUrl = departmentId
    ? `/api/reporting/available-entry-kinds?departmentId=${encodeURIComponent(departmentId)}${
        role ? `&role=${encodeURIComponent(role)}` : ""
      }`
    : null

  const { data: availableKindsData, isLoading: isChecking } = useSWR(
    availableKindsUrl,
    async (url: string) => {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch available entry kinds")
      const json = await res.json()
      return json as { data: any[] }
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  // Filter entry kinds based on enriched metadata and reachability from the new API
  const availableKinds = useMemo(() => {
    const kinds = (availableKindsData?.data || []) as ScopeEntryKind[]
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
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          No report types available for your role in this department.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="entry-kind-select">{label}</Label>
      <Select
        value={value || "standard"}
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
      {availableKinds.length <= 1 && (
        <p className="text-muted-foreground text-xs">Only one report type is available for your role.</p>
      )}
    </div>
  )
}
