"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useMarketingDashboard } from "@/contexts/marketing-dashboard-context"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatKpiDurationFromMinutes } from "@/lib/marketing-kpis/formatting/format-kpi-duration"
import { formatKpiNumber } from "@/lib/marketing-kpis/formatting/format-kpi-number"

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
  const [agentsContacted, setAgentsContacted] = useState<KpiState>({ status: "loading" })
  const [agentComplaints, setAgentComplaints] = useState<KpiState>({ status: "loading" })
  const [postsPrepared, setPostsPrepared] = useState<KpiState>({ status: "loading" })
  const [followersAdded, setFollowersAdded] = useState<KpiState>({ status: "loading" })
  const [callMinutes, setCallMinutes] = useState<KpiState>({ status: "loading" })
  const [majorActivitiesCount, setMajorActivitiesCount] = useState<KpiState>({ status: "loading" })
  const [agentContactsCount, setAgentContactsCount] = useState<KpiState>({ status: "loading" })
  const [supervisorDailyReportsCount, setSupervisorDailyReportsCount] = useState<KpiState>({ status: "loading" })
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

  const agentsRequestIdRef = useRef(0)
  const agentsAbortRef = useRef<AbortController | null>(null)

  const loadAgentsContacted = async (url: string, label: string) => {
    const requestId = ++agentsRequestIdRef.current
    try {
      setAgentsContacted({ status: "loading" })
      agentsAbortRef.current?.abort()
      const ac = new AbortController()
      agentsAbortRef.current = ac

      const res = await fetch(url, { signal: ac.signal })
      const json = await res.json().catch(() => ({}))
      if (requestId !== agentsRequestIdRef.current) return
      if (!res.ok) {
        setAgentsContacted({ status: "error", message: json?.message || json?.error || "Failed to load KPI" })
        return
      }
      setAgentsContacted({ status: "loaded", value: Number(json?.value || 0), windowLabel: label })
    } catch {
      if (requestId !== agentsRequestIdRef.current) return
      setAgentsContacted({ status: "error", message: "Failed to load KPI" })
    }
  }

  const complaintsRequestIdRef = useRef(0)
  const complaintsAbortRef = useRef<AbortController | null>(null)

  const loadAgentComplaints = async (url: string, label: string) => {
    const requestId = ++complaintsRequestIdRef.current
    try {
      setAgentComplaints({ status: "loading" })
      complaintsAbortRef.current?.abort()
      const ac = new AbortController()
      complaintsAbortRef.current = ac

      const res = await fetch(url, { signal: ac.signal })
      const json = await res.json().catch(() => ({}))
      if (requestId !== complaintsRequestIdRef.current) return
      if (!res.ok) {
        setAgentComplaints({ status: "error", message: json?.message || json?.error || "Failed to load KPI" })
        return
      }
      setAgentComplaints({ status: "loaded", value: Number(json?.value || 0), windowLabel: label })
    } catch {
      if (requestId !== complaintsRequestIdRef.current) return
      setAgentComplaints({ status: "error", message: "Failed to load KPI" })
    }
  }

  const postsRequestIdRef = useRef(0)
  const postsAbortRef = useRef<AbortController | null>(null)

  const loadPostsPrepared = async (url: string, label: string) => {
    const requestId = ++postsRequestIdRef.current
    try {
      setPostsPrepared({ status: "loading" })
      postsAbortRef.current?.abort()
      const ac = new AbortController()
      postsAbortRef.current = ac

      const res = await fetch(url, { signal: ac.signal })
      const json = await res.json().catch(() => ({}))
      if (requestId !== postsRequestIdRef.current) return
      if (!res.ok) {
        setPostsPrepared({ status: "error", message: json?.message || json?.error || "Failed to load KPI" })
        return
      }
      setPostsPrepared({ status: "loaded", value: Number(json?.value || 0), windowLabel: label })
    } catch {
      if (requestId !== postsRequestIdRef.current) return
      setPostsPrepared({ status: "error", message: "Failed to load KPI" })
    }
  }

  const makeKpiLoader = (
    setState: Dispatch<SetStateAction<KpiState>>,
    requestIdRef: MutableRefObject<number>,
    abortRef: MutableRefObject<AbortController | null>
  ) => {
    return async (url: string, label: string) => {
      const requestId = ++requestIdRef.current
      try {
        setState({ status: "loading" })
        abortRef.current?.abort()
        const ac = new AbortController()
        abortRef.current = ac

        const res = await fetch(url, { signal: ac.signal })
        const json = await res.json().catch(() => ({}))
        if (requestId !== requestIdRef.current) return
        if (!res.ok) {
          setState({ status: "error", message: json?.message || json?.error || "Failed to load KPI" })
          return
        }
        setState({ status: "loaded", value: Number(json?.value || 0), windowLabel: label })
      } catch {
        if (requestId !== requestIdRef.current) return
        setState({ status: "error", message: "Failed to load KPI" })
      }
    }
  }

  const followersRequestIdRef = useRef(0)
  const followersAbortRef = useRef<AbortController | null>(null)
  const loadFollowersAdded = makeKpiLoader(setFollowersAdded, followersRequestIdRef, followersAbortRef)

  const callMinutesRequestIdRef = useRef(0)
  const callMinutesAbortRef = useRef<AbortController | null>(null)
  const loadCallMinutes = makeKpiLoader(setCallMinutes, callMinutesRequestIdRef, callMinutesAbortRef)

  const majorActivitiesRequestIdRef = useRef(0)
  const majorActivitiesAbortRef = useRef<AbortController | null>(null)
  const loadMajorActivitiesCount = makeKpiLoader(setMajorActivitiesCount, majorActivitiesRequestIdRef, majorActivitiesAbortRef)

  const agentContactsCountRequestIdRef = useRef(0)
  const agentContactsCountAbortRef = useRef<AbortController | null>(null)
  const loadAgentContactsCount = makeKpiLoader(setAgentContactsCount, agentContactsCountRequestIdRef, agentContactsCountAbortRef)

  const supervisorDailyReportsRequestIdRef = useRef(0)
  const supervisorDailyReportsAbortRef = useRef<AbortController | null>(null)
  const loadSupervisorDailyReportsCount = makeKpiLoader(
    setSupervisorDailyReportsCount,
    supervisorDailyReportsRequestIdRef,
    supervisorDailyReportsAbortRef
  )

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

    const agentsUrl = `/api/marketing/kpis/agents-contacted?${sp.toString()}`
    loadAgentsContacted(agentsUrl, windowLabel)

    const complaintsUrl = `/api/marketing/kpis/agent-complaints?${sp.toString()}`
    loadAgentComplaints(complaintsUrl, windowLabel)

    const postsUrl = `/api/marketing/kpis/posts-prepared?${sp.toString()}`
    loadPostsPrepared(postsUrl, windowLabel)

    loadFollowersAdded(`/api/marketing/kpis/followers-added?${sp.toString()}`, windowLabel)
    loadCallMinutes(`/api/marketing/kpis/call-minutes?${sp.toString()}`, windowLabel)
    loadMajorActivitiesCount(`/api/marketing/kpis/major-activities-count?${sp.toString()}`, windowLabel)
    loadAgentContactsCount(`/api/marketing/kpis/agent-contacts-count?${sp.toString()}`, windowLabel)
    loadSupervisorDailyReportsCount(`/api/marketing/kpis/supervisor-daily-reports-count?${sp.toString()}`, windowLabel)

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

  const buildQueryString = () => {
    const sp = new URLSearchParams()
    if (isCustom) {
      if (dateFrom) sp.set("dateFrom", dateFrom)
      if (dateTo) sp.set("dateTo", dateTo)
    } else {
      sp.set("preset", preset)
    }
    return sp.toString()
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">No. of followers added ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">Sum of configured follower counts across marketing workflows.</div>
            </div>
            {followersAdded.status === "error" ? (
              <Button variant="outline" size="sm" onClick={() => loadFollowersAdded(`/api/marketing/kpis/followers-added?${buildQueryString()}`, windowLabel)}>
                Retry
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            {followersAdded.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : followersAdded.status === "error" ? (
              <div className="text-sm text-destructive">{followersAdded.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{followersAdded.value}</div>
                <div className="text-muted-foreground text-xs">
                  {followersAdded.value === 0 ? "No followers added in this period." : `${followersAdded.value} followers for ${followersAdded.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">No. of calls (minutes) ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">Total conversation minutes from the configured call-duration question.</div>
            </div>
            {callMinutes.status === "error" ? (
              <Button variant="outline" size="sm" onClick={() => loadCallMinutes(`/api/marketing/kpis/call-minutes?${buildQueryString()}`, windowLabel)}>
                Retry
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            {callMinutes.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : callMinutes.status === "error" ? (
              <div className="text-sm text-destructive">{callMinutes.message}</div>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const duration = formatKpiDurationFromMinutes(callMinutes.value)
                  const preciseMinutes = formatKpiNumber(callMinutes.value, { maximumFractionDigits: 2 })
                  return (
                    <>
                      <div className="text-3xl font-semibold tabular-nums">{duration.headline}</div>
                      <div className="text-muted-foreground text-xs">
                        {duration.isValid
                          ? callMinutes.value === 0
                            ? "No call minutes recorded in this period."
                            : `${preciseMinutes} total minutes for ${callMinutes.windowLabel}.`
                          : "Unavailable"}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">No. of major activities ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">Count of major-activity workflow entries submitted in this period.</div>
            </div>
            {majorActivitiesCount.status === "error" ? (
              <Button variant="outline" size="sm" onClick={() => loadMajorActivitiesCount(`/api/marketing/kpis/major-activities-count?${buildQueryString()}`, windowLabel)}>
                Retry
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            {majorActivitiesCount.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : majorActivitiesCount.status === "error" ? (
              <div className="text-sm text-destructive">{majorActivitiesCount.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{majorActivitiesCount.value}</div>
                <div className="text-muted-foreground text-xs">
                  {majorActivitiesCount.value === 0 ? "No major-activity logs in this period." : `${majorActivitiesCount.value} logs for ${majorActivitiesCount.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">No. of agent contacts (sales promoters) ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">Count of agent-contact workflow entries in this period.</div>
            </div>
            {agentContactsCount.status === "error" ? (
              <Button variant="outline" size="sm" onClick={() => loadAgentContactsCount(`/api/marketing/kpis/agent-contacts-count?${buildQueryString()}`, windowLabel)}>
                Retry
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            {agentContactsCount.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : agentContactsCount.status === "error" ? (
              <div className="text-sm text-destructive">{agentContactsCount.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{agentContactsCount.value}</div>
                <div className="text-muted-foreground text-xs">
                  {agentContactsCount.value === 0 ? "No agent-contact logs in this period." : `${agentContactsCount.value} logs for ${agentContactsCount.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Daily reports (supervisors) ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">Count of supervisor daily-report workflow entries in this period.</div>
            </div>
            {supervisorDailyReportsCount.status === "error" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  loadSupervisorDailyReportsCount(`/api/marketing/kpis/supervisor-daily-reports-count?${buildQueryString()}`, windowLabel)
                }
              >
                Retry
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            {supervisorDailyReportsCount.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : supervisorDailyReportsCount.status === "error" ? (
              <div className="text-sm text-destructive">{supervisorDailyReportsCount.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{supervisorDailyReportsCount.value}</div>
                <div className="text-muted-foreground text-xs">
                  {supervisorDailyReportsCount.value === 0
                    ? "No supervisor daily reports in this period."
                    : `${supervisorDailyReportsCount.value} logs for ${supervisorDailyReportsCount.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Number of agents contacted ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Distinct agents with at least one contact log in this period.
              </div>
            </div>
            {agentsContacted.status === "error" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAgentsContacted(`/api/marketing/kpis/agents-contacted?${buildQueryString()}`, windowLabel)}
              >
                Retry
              </Button>
            ) : null}
          </div>

          <div className="mt-4">
            {agentsContacted.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : agentsContacted.status === "error" ? (
              <div className="text-sm text-destructive">{agentsContacted.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{agentsContacted.value}</div>
                <div className="text-muted-foreground text-xs">
                  {agentsContacted.value === 0
                    ? "No agents contacted in this period."
                    : `${agentsContacted.value} unique agent${
                        agentsContacted.value === 1 ? "" : "s"
                      } for ${agentsContacted.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Agent complaints ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Count of contact logs where &ldquo;Are there any complaints from agent?&rdquo; = Yes.
              </div>
            </div>
            {agentComplaints.status === "error" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAgentComplaints(`/api/marketing/kpis/agent-complaints?${buildQueryString()}`, windowLabel)}
              >
                Retry
              </Button>
            ) : null}
          </div>

          <div className="mt-4">
            {agentComplaints.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : agentComplaints.status === "error" ? (
              <div className="text-sm text-destructive">{agentComplaints.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{agentComplaints.value}</div>
                <div className="text-muted-foreground text-xs">
                  {agentComplaints.value === 0
                    ? "No complaints recorded in this period."
                    : `${agentComplaints.value} complaint${agentComplaints.value === 1 ? "" : "s"} recorded for ${agentComplaints.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Posts prepared ({windowLabel})</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Total uploaded post-content images from the configured “post content shared” questions.
              </div>
            </div>
            {postsPrepared.status === "error" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPostsPrepared(`/api/marketing/kpis/posts-prepared?${buildQueryString()}`, windowLabel)}
              >
                Retry
              </Button>
            ) : null}
          </div>

          <div className="mt-4">
            {postsPrepared.status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : postsPrepared.status === "error" ? (
              <div className="text-sm text-destructive">{postsPrepared.message}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-3xl font-semibold tabular-nums">{postsPrepared.value}</div>
                <div className="text-muted-foreground text-xs">
                  {postsPrepared.value === 0
                    ? "No post content entries recorded in this period."
                    : `${postsPrepared.value} ${postsPrepared.value === 1 ? "entry" : "entries"} for ${postsPrepared.windowLabel}.`}
                </div>
              </div>
            )}
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
                onClick={() => load(`/api/marketing/kpis/agent-calls?${buildQueryString()}`, windowLabel)}
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
                  {kpi.value === 0 ? "No agent contacts recorded in this period." : `Total agent contacts for ${kpi.windowLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

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

function formatFailureReasonLabel(reasonKey: string) {
  const key = String(reasonKey || "").trim()
  const known: Record<string, string> = {
    no_answer: "No answer",
    line_busy: "Line busy",
    phone_off: "Phone off",
    unreachable: "Unreachable",
    wrong_number: "Wrong number",
    not_available: "Not available",
    refused: "Refused",
    other: "Other",
  }

  if (known[key]) return known[key]

  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function OutcomeReasonsChart({ reasons, failed }: { reasons: Record<string, number>; failed: number }) {
  const data = Object.entries(reasons || {})
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8)
    .map(([reason, n]) => ({
      reason,
      reasonLabel: formatFailureReasonLabel(reason),
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
          <XAxis dataKey="reasonLabel" tickLine={false} axisLine={false} interval={0} height={60} />
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
