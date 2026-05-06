"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { indexTeamMember, matchesTeamSearch } from "@/lib/marketing/team-filters"

type TeamMember = {
  userId: string
  name: string | null
  phoneRaw: string | null
  phone: string | null
  phoneVisible: boolean
  role: { id: string; name: string; displayName: string | null } | null
  team: { membershipType: string; isPrimary: boolean }
  lastUpdated: string
  stats: { summary: null; window: null }
}

type TeamData = {
  department: { id: string; name: string; slug: string }
  members: TeamMember[]
  meta: { hasMore: boolean }
}

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: TeamData }

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

function PhoneCell({ phone, phoneVisible }: { phone: string | null; phoneVisible: boolean }) {
  if (phone) {
    return <span className="font-mono text-sm">{phone}</span>
  }

  const tooltipText = phoneVisible ? "Not provided" : "Restricted"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground cursor-default">—</span>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

export default function MarketingTeamPage() {
  const [state, setState] = useState<PageState>({ status: "loading" })
  const requestIdRef = useRef(0)
  const [q, setQ] = useState("")
  const [selectedRoleKey, setSelectedRoleKey] = useState("all")
  const debouncedQ = useDebouncedValue(q, 150)

  useEffect(() => {
    const requestId = ++requestIdRef.current

    async function load() {
      try {
        setState({ status: "loading" })
        const res = await fetch("/api/marketing/team")
        const json = await res.json().catch(() => ({}))

        if (requestId !== requestIdRef.current) return

        if (!res.ok) {
          setState({ status: "error", message: json?.message || json?.error || "Failed to load team" })
          return
        }

        setState({ status: "loaded", data: json.data })
      } catch {
        if (requestId !== requestIdRef.current) return
        setState({ status: "error", message: "Failed to load team" })
      }
    }

    load()
  }, [])

  const members = state.status === "loaded" ? state.data.members : []
  const hasMore = state.status === "loaded" ? state.data.meta.hasMore : false

  const indexed = useMemo(() => {
    return members.map((m) => {
      const roleLabel = m.role?.displayName || m.role?.name || ""
      const indexedMember = indexTeamMember({
        userId: m.userId,
        name: m.name,
        phoneVisible: m.phoneVisible,
        phoneRaw: m.phoneRaw,
        roleLabel,
      })

      return {
        ...m,
        _roleLabel: roleLabel,
        _roleKey: indexedMember.roleKey,
        _nameKey: indexedMember.nameKey,
        _phoneE164: indexedMember.phoneE164,
        _phoneDigits: indexedMember.phoneDigits,
        _hasDisplayName: Boolean(m.role?.displayName),
      }
    })
  }, [members])

  const roleOptions = useMemo(() => {
    const map = new Map<string, { label: string; hasDisplayName: boolean }>()
    for (const m of indexed) {
      if (!m._roleKey) continue
      const existing = map.get(m._roleKey)
      if (!existing) {
        map.set(m._roleKey, { label: m._roleLabel, hasDisplayName: m._hasDisplayName })
        continue
      }
      // Prefer displayName-derived labels when available
      if (!existing.hasDisplayName && m._hasDisplayName && m._roleLabel) {
        map.set(m._roleKey, { label: m._roleLabel, hasDisplayName: true })
      }
    }
    const opts = Array.from(map.entries()).map(([key, v]) => ({ key, label: v.label || key }))
    opts.sort((a, b) => a.label.localeCompare(b.label))
    return [{ key: "all", label: "All" }, ...opts]
  }, [indexed])

  const filtersActive = debouncedQ.trim() !== "" || selectedRoleKey !== "all"

  const filtered = useMemo(() => {
    const roleKeyWanted = selectedRoleKey

    const list = indexed.filter((m) => {
      const roleMatch = roleKeyWanted === "all" || m._roleKey === roleKeyWanted
      if (!roleMatch) return false

      const indexedMember = indexTeamMember({
        userId: m.userId,
        name: m.name,
        phoneVisible: m.phoneVisible,
        phoneRaw: m.phoneRaw,
        roleLabel: m._roleLabel,
      })
      return matchesTeamSearch({ member: indexedMember, query: debouncedQ, minPhoneDigits: 5 })
    })

    // Stable deterministic sort (roleLabel, name, userId)
    return list.slice().sort((a, b) => {
      const roleA = (a._roleLabel ?? "").toLowerCase()
      const roleB = (b._roleLabel ?? "").toLowerCase()
      const nameA = (a.name ?? "").toLowerCase()
      const nameB = (b.name ?? "").toLowerCase()
      return (
        roleA.localeCompare(roleB) ||
        nameA.localeCompare(nameB) ||
        a.userId.localeCompare(b.userId)
      )
    })
  }, [indexed, debouncedQ, selectedRoleKey])

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground text-sm">
          Marketing department members
        </p>
      </div>

      {state.status === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              requestIdRef.current++
              setState({ status: "loading" })
              fetch("/api/marketing/team")
                .then((res) => res.json())
                .then((json) => {
                  if (!json.data) {
                    setState({ status: "error", message: json?.message || json?.error || "Failed to load team" })
                    return
                  }
                  setState({ status: "loaded", data: json.data })
                })
                .catch(() => setState({ status: "error", message: "Failed to load team" }))
            }}
          >
            Retry
          </Button>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-muted-foreground text-sm">No team members found.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or phone…"
                className="sm:max-w-xs"
              />
              <Select value={selectedRoleKey} onValueChange={setSelectedRoleKey}>
                <SelectTrigger className="sm:w-[240px]">
                  <SelectValue placeholder="Job Position" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQ("")
                setSelectedRoleKey("all")
              }}
            >
              Clear
            </Button>
          </div>

          <div className="text-muted-foreground text-xs">
            Showing {filtered.length} of {members.length} members
            {hasMore && filtersActive && (
              <span className="ml-2">Filtering applies to the first 100 loaded members.</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border p-6 text-center">
              <p className="text-muted-foreground text-sm">
                {filtersActive ? `No results for “${debouncedQ.trim()}”.` : "No team members found."}
              </p>
            </div>
          ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Job Position</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell className="font-medium">
                      {member.name || "—"}
                    </TableCell>
                    <TableCell>
                      {member.role?.displayName || member.role?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <PhoneCell phone={member.phone} phoneVisible={member.phoneVisible} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Sorted by Role (A–Z), then Name (A–Z)</span>
            {hasMore && <span>Showing first 100 members</span>}
          </div>
        </>
      )}
    </div>
  )
}
