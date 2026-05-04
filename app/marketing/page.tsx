"use client"

import { useEffect, useState } from "react"
import { useMarketingDashboard } from "@/contexts/marketing-dashboard-context"
import { getDaysAgo } from "@/lib/date-restrictions"
import { Button } from "@/components/ui/button"

type KpiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; value: number; date: string }

export default function MarketingDashboardHome() {
  const { marketingDepartmentName } = useMarketingDashboard()
  const [kpi, setKpi] = useState<KpiState>({ status: "loading" })

  const date = getDaysAgo(1)

  const load = async () => {
    try {
      setKpi({ status: "loading" })
      const res = await fetch(`/api/marketing/kpis/agent-calls?date=${encodeURIComponent(date)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setKpi({ status: "error", message: json?.error || "Failed to load KPI" })
        return
      }
      setKpi({ status: "loaded", value: Number(json?.value || 0), date: String(json?.date || date) })
    } catch {
      setKpi({ status: "error", message: "Failed to load KPI" })
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Marketing Dashboard</h1>
        <p className="text-muted-foreground text-sm">Department: {marketingDepartmentName || "Marketing"}</p>
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Calls done (Yesterday)</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Each saved Agent Call log counts as one call. Date is EAT (UTC+3).
            </div>
          </div>
          {kpi.status === "error" ? (
            <Button variant="outline" size="sm" onClick={load}>
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
                {kpi.value === 0 ? "No calls recorded yesterday." : `Agent Call entries on ${kpi.date}.`}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
