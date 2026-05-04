"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMarketingDashboard } from "@/contexts/marketing-dashboard-context"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type KpiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; value: number; windowLabel: string }

export default function MarketingDashboardHome() {
  const { marketingDepartmentName } = useMarketingDashboard()
  const [kpi, setKpi] = useState<KpiState>({ status: "loading" })

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const preset = (searchParams.get("preset") || "yesterday").trim()
  const dateFrom = (searchParams.get("dateFrom") || "").trim()
  const dateTo = (searchParams.get("dateTo") || "").trim()
  const isCustom = preset === "custom"

  const windowLabel = useMemo(() => {
    if (isCustom && dateFrom && dateTo) return `${dateFrom} → ${dateTo}`
    if (preset === "today") return "Today"
    if (preset === "yesterday") return "Yesterday"
    if (preset === "last7") return "Last 7 days"
    if (preset === "thisMonth") return "This month (MTD)"
    return "Yesterday"
  }, [dateFrom, dateTo, isCustom, preset])

  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const load = async (url: string, label: string) => {
    const requestId = ++requestIdRef.current
    try {
      setKpi({ status: "loading" })
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      const res = await fetch(url, { signal: ac.signal })
      const json = await res.json().catch(() => ({}))
      if (requestId !== requestIdRef.current) return
      if (!res.ok) {
        setKpi({ status: "error", message: json?.message || json?.error || "Failed to load KPI" })
        return
      }
      setKpi({ status: "loaded", value: Number(json?.value || 0), windowLabel: label })
    } catch {
      if (requestId !== requestIdRef.current) return
      setKpi({ status: "error", message: "Failed to load KPI" })
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams()
    if (isCustom) {
      if (dateFrom) sp.set("dateFrom", dateFrom)
      if (dateTo) sp.set("dateTo", dateTo)
    } else {
      sp.set("preset", preset)
    }
    const url = `/api/marketing/kpis/agent-calls?${sp.toString()}`
    load(url, windowLabel)
  }, [preset, dateFrom, dateTo, isCustom, windowLabel])

  const setUrlParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k)
      else sp.set(k, v)
    }
    router.replace(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Marketing Dashboard</h1>
        <p className="text-muted-foreground text-sm">Department: {marketingDepartmentName || "Marketing"}</p>
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Date filter</div>
            <div className="text-muted-foreground text-xs">Dates are EAT (UTC+3) calendar days.</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={preset}
              onChange={(e) => {
                const value = e.target.value
                if (value === "custom") {
                  setUrlParams({ preset: "custom" })
                } else {
                  setUrlParams({ preset: value, dateFrom: null, dateTo: null })
                }
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month (MTD)</option>
              <option value="custom">Custom</option>
            </select>

            {isCustom ? (
              <>
                <input
                  type="date"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={dateFrom}
                  onChange={(e) => setUrlParams({ dateFrom: e.target.value || null, preset: "custom" })}
                />
                <input
                  type="date"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={dateTo}
                  onChange={(e) => setUrlParams({ dateTo: e.target.value || null, preset: "custom" })}
                />
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Calls done ({windowLabel})</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Each saved Agent Contact log counts as one call. Date is EAT (UTC+3).
            </div>
          </div>
          {kpi.status === "error" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const sp = new URLSearchParams()
                if (isCustom) {
                  if (dateFrom) sp.set("dateFrom", dateFrom)
                  if (dateTo) sp.set("dateTo", dateTo)
                } else {
                  sp.set("preset", preset)
                }
                load(`/api/marketing/kpis/agent-calls?${sp.toString()}`, windowLabel)
              }}
            >
              Retry
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          {kpi.status === "loading" ? (
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
          ) : kpi.status === "error" ? (
            <div className="text-sm text-destructive">{kpi.message}</div>
          ) : (
            <div className="space-y-1">
              <div className="text-3xl font-semibold tabular-nums">{kpi.value}</div>
              <div className="text-muted-foreground text-xs">
                {kpi.value === 0
                  ? "No agent calls recorded in this period."
                  : `Total agent calls for ${kpi.windowLabel}.`}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
