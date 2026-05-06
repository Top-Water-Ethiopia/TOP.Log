"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMarketingDashboard } from "@/contexts/marketing-dashboard-context"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

type KpiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; value: number; windowLabel: string }

type OutcomesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "loaded"
      totals: { total: number; success: number; failed: number; missing: number }
      rates: { successRate: number; missingRate: number }
      reasons: Record<string, number>
      windowLabel: string
    }

export default function MarketingDashboardHome() {
  const { marketingDepartmentName } = useMarketingDashboard()
  const [kpi, setKpi] = useState<KpiState>({ status: "loading" })
  const [outcomes, setOutcomes] = useState<OutcomesState>({ status: "loading" })

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

  const outcomesRequestIdRef = useRef(0)
  const outcomesAbortRef = useRef<AbortController | null>(null)

  const loadOutcomes = async (url: string, label: string) => {
    const requestId = ++outcomesRequestIdRef.current
    try {
      setOutcomes({ status: "loading" })
      outcomesAbortRef.current?.abort()
      const ac = new AbortController()
      outcomesAbortRef.current = ac

      const res = await fetch(url, { signal: ac.signal })
      const json = await res.json().catch(() => ({}))
      if (requestId !== outcomesRequestIdRef.current) return
      if (!res.ok) {
        setOutcomes({ status: "error", message: json?.message || json?.error || "Failed to load outcome stats" })
        return
      }

      const totals = json?.totals || {}
      const rates = json?.rates || {}
      const reasons = json?.reasons || {}
      setOutcomes({
        status: "loaded",
        totals: {
          total: Number(totals.total || 0),
          success: Number(totals.success || 0),
          failed: Number(totals.failed || 0),
          missing: Number(totals.missing || 0),
        },
        rates: { successRate: Number(rates.successRate || 0), missingRate: Number(rates.missingRate || 0) },
        reasons: typeof reasons === "object" && reasons ? (reasons as Record<string, number>) : {},
        windowLabel: label,
      })
    } catch {
      if (requestId !== outcomesRequestIdRef.current) return
      setOutcomes({ status: "error", message: "Failed to load outcome stats" })
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

    const outcomesUrl = `/api/marketing/kpis/agent-contact-outcomes?${sp.toString()}`
    loadOutcomes(outcomesUrl, windowLabel)
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
                  ? "No agent contacts recorded in this period."
                  : `Total agent contacts for ${kpi.windowLabel}.`}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Contact outcomes ({windowLabel})</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Missing is “no valid answer recorded”. Reasons are multi-select: a contact can count toward multiple reasons.
            </div>
          </div>
          {outcomes.status === "error" ? (
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
                loadOutcomes(`/api/marketing/kpis/agent-contact-outcomes?${sp.toString()}`, windowLabel)
              }}
            >
              Retry
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          {outcomes.status === "loading" ? (
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          ) : outcomes.status === "error" ? (
            <div className="text-sm text-destructive">{outcomes.message}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Success</div>
                  <div className="text-xl font-semibold tabular-nums">{outcomes.totals.success}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Failed</div>
                  <div className="text-xl font-semibold tabular-nums">{outcomes.totals.failed}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Missing</div>
                  <div className="text-xl font-semibold tabular-nums">{outcomes.totals.missing}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Success rate</div>
                  <div className="text-xl font-semibold tabular-nums">{Math.round(outcomes.rates.successRate * 100)}%</div>
                  <div className="text-muted-foreground text-[11px]">Excludes missing</div>
                </div>
              </div>

              <OutcomeReasonsChart reasons={outcomes.reasons} failed={outcomes.totals.failed} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const reasonsChartConfig: ChartConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
}

function OutcomeReasonsChart({ reasons, failed }: { reasons: Record<string, number>; failed: number }) {
  const data = Object.entries(reasons || {})
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8)
    .map(([reason, n]) => ({
      reason,
      count: Number(n),
      percentOfFailed: failed > 0 ? Math.round((Number(n) / failed) * 100) : 0,
    }))

  if (data.length === 0) {
    return <div className="text-muted-foreground text-sm">No failure reasons recorded in this period.</div>
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Failure reasons</div>
      <div className="text-muted-foreground text-xs">% of failed contacts selecting each reason (multi-select allowed)</div>
      <ChartContainer config={reasonsChartConfig} className="h-[280px] w-full">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="reason" tickLine={false} axisLine={false} interval={0} height={60} />
          <YAxis allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const v = Number(value)
                  const pct = (item?.payload as any)?.percentOfFailed
                  return [`${v} (${pct}%)`, name]
                }}
              />
            }
          />
          <Bar dataKey="count" fill="var(--color-count)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
