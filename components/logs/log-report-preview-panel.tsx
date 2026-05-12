"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Calendar, ExternalLink, Info, Loader2, MapPin, Phone, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { ImageResponsePreview } from "@/components/image-response-preview"
import { formatDateHuman } from "@/lib/date-restrictions"
import { normalizeImageResponseValue } from "@/lib/image-upload"
import { FilesTabs } from "@/components/logs/files-tabs"
import {
  compareLogAssetsNewestFirst,
  dedupeLogAssetsKeepingNewest,
  extractLogAssetsFromResponses,
  type LogAssetSourceResponse,
} from "@/lib/log-assets"
import { buildLogsPageHrefFromState } from "@/lib/logs-page-filters"
import { useLogsPageState } from "@/hooks/use-logs-page-state"

interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

interface ReportPreview {
  created_at: string
  custom_responses?: CustomResponse[]
  date: string
  entry_kind?: string | null
  id: string
  profile?: {
    name: string | null
  } | null
  subject_agent_snapshot?: {
    name?: string | null
    location?: string | null
    phone?: string | null
  } | null
}

interface LogReportPreviewPanelProps {
  canAccessAdmin: boolean
  closeHref?: string
  reportId?: string
}

function formatResponseValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided"
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "Not provided"
    return value
      .map((item) => {
        // Handle enriched objects with name property
        if (typeof item === "object" && item !== null) {
          const name = (item as { name?: unknown }).name
          if (typeof name === "string" && name.trim()) {
            return name
          }
          const label = (item as { label?: unknown }).label
          if (typeof label === "string" && label.trim()) {
            return label
          }
        }
        return String(item)
      })
      .join(", ")
  }

  if (typeof value === "object") {
    const label = (value as { label?: unknown }).label
    if (typeof label === "string" && label.trim()) {
      return label
    }

    const name = (value as { name?: unknown }).name
    if (typeof name === "string" && name.trim()) {
      return name
    }

    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

function renderResponseValue(response: CustomResponse) {
  const questionType = response.question_type ?? "text"
  const { value } = response
  const imageAssets = questionType === "image" ? normalizeImageResponseValue(value) : []

  if (questionType === "image" && imageAssets.length > 0) {
    return <ImageResponsePreview value={value} />
  }

  return formatResponseValue(value)
}

export function LogReportPreviewPanel({ canAccessAdmin, closeHref, reportId }: LogReportPreviewPanelProps) {
  const router = useRouter()
  const { state, isCursorExpired } = useLogsPageState()
  const prevCursorRef = useRef(state.nextCursorDate)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [report, setReport] = useState<ReportPreview | null>(null)
  const [showExpiryIndicator, setShowExpiryIndicator] = useState(false)

  // Detect cursor expiry transition
  useEffect(() => {
    if (prevCursorRef.current && !state.nextCursorDate) {
      // Cursor was removed - this could be due to expiry
      setShowExpiryIndicator(true)
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setShowExpiryIndicator(false), 5000)
      return () => clearTimeout(timer)
    }
    prevCursorRef.current = state.nextCursorDate
  }, [state.nextCursorDate])

  useEffect(() => {
    if (!reportId) {
      setReport(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadReport = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/reports/${reportId}`, { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error || payload.message || `HTTP ${response.status}`)
        }

        if (!cancelled) {
          setReport((payload.data || null) as ReportPreview | null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setReport(null)
          setError(loadError instanceof Error ? loadError.message : "Failed to load report preview")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadReport()

    return () => {
      cancelled = true
    }
  }, [reportId])

  const responses = useMemo(() => {
    return (report?.custom_responses || []).filter((response) => {
      const value = response.value
      if (value === null || value === undefined || value === "") return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    })
  }, [report])

  const assets = useMemo(() => {
    if (!report) return []
    const sourceResponses: LogAssetSourceResponse[] = responses.map((r) => ({
      question_type: r.question_type,
      question_key: r.question_key,
      question_label: r.question_label,
      value: r.value,
    }))
    const extracted = extractLogAssetsFromResponses(sourceResponses, {
      entryId: report.id,
      entryDate: report.date,
      entryCreatedAt: report.created_at,
      entryUserId: null,
    })
    return dedupeLogAssetsKeepingNewest(extracted).sort(compareLogAssetsNewestFirst)
  }, [report, responses])

  const { docs, media } = useMemo(() => {
    const mediaAssets = assets.filter((a) => a.kind === "image")
    const docAssets = assets.filter((a) => a.kind === "document")
    return { docs: docAssets, media: mediaAssets }
  }, [assets])

  if (!reportId) {
    return null
  }

  return (
    <RightSidePanel
      open={!!reportId}
      onOpenChange={(open) => {
        if (!open) {
          if (closeHref) {
            router.replace(closeHref)
            return
          }

          const fallbackCloseHref = buildLogsPageHrefFromState({
            date: state.date || "",
            departmentId: state.departmentId || "",
            month: state.month,
            page: state.page,
            searchName: state.searchName || "",
            selectedLogId: "",
            view: state.view,
            nextCursorDate: isCursorExpired ? "" : state.nextCursorDate || "",
            nextCursorId: isCursorExpired ? "" : state.nextCursorId || "",
            professionRoleId: state.professionRoleId || "",
            entryKind: state.entryKind || "",
          })
          router.replace(fallbackCloseHref)
        }
      }}
      title={report?.profile?.name || "Report preview"}
      description={report?.date ? formatDateHuman(report.date) : "Quick review without leaving the logs page."}
      footer={
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href={`/reports/${reportId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open full report
            </Link>
          </Button>
          {canAccessAdmin ? (
            <Button variant="outline" asChild>
              <Link href={`/admin/reports/${reportId}`}>
                <Shield className="mr-2 h-4 w-4" />
                Open admin detail
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-muted/30 rounded-lg border p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {showExpiryIndicator ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start gap-2 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-800 dark:text-amber-200">Session expired, showing latest results</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateHuman(report.date)}
            </Badge>
            {report.entry_kind === "agent_call" ? <Badge variant="outline">Agent Call</Badge> : null}
            <Badge variant="outline">
              {responses.length} response{responses.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {assets.length > 0 ? <FilesTabs media={media} docs={docs} /> : null}

          {report.subject_agent_snapshot?.name ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="text-sm font-semibold">{report.subject_agent_snapshot.name}</div>
              <div className="space-y-2 text-sm">
                {report.subject_agent_snapshot.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span>{report.subject_agent_snapshot.location}</span>
                  </div>
                ) : null}
                {report.subject_agent_snapshot.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span>{report.subject_agent_snapshot.phone}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {responses.length === 0 ? (
            <div className="bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
              No responses were recorded for this report.
            </div>
          ) : (
            <div className="space-y-4">
              {responses.map((response, index) => (
                <div key={`${response.question_id}-${index}`} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="text-muted-foreground w-6 text-right text-sm font-semibold tabular-nums">
                      {index + 1}.
                    </div>
                    <div className="flex-1 text-sm font-semibold">
                      {response.question_label || response.question_key}
                    </div>
                  </div>
                  <div className="bg-muted/40 ml-8 rounded-lg border p-3 text-sm whitespace-pre-wrap">
                    {renderResponseValue(response)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </RightSidePanel>
  )
}
