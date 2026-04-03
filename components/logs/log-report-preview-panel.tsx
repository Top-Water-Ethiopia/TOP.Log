"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Calendar, ExternalLink, Loader2, MapPin, Phone, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RightSidePanel } from "@/components/ui/right-side-panel"
import { formatDateHuman } from "@/lib/date-restrictions"

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
  closeHref: string
  reportId?: string
}

function formatResponseValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided"
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => String(item)).join(", ") : "Not provided"
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

export function LogReportPreviewPanel({ canAccessAdmin, closeHref, reportId }: LogReportPreviewPanelProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [report, setReport] = useState<ReportPreview | null>(null)

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

  if (!reportId) {
    return null
  }

  return (
    <RightSidePanel
      open={!!reportId}
      onOpenChange={(open) => {
        if (!open) {
          router.replace(closeHref)
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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateHuman(report.date)}
            </Badge>
            {report.entry_kind === "agent_call" ? <Badge variant="outline">Agent Call</Badge> : null}
            <Badge variant="outline">{responses.length} response{responses.length === 1 ? "" : "s"}</Badge>
          </div>

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
                  <div className="text-sm font-semibold">{response.question_label || response.question_key}</div>
                  <div className="bg-muted/40 rounded-lg border p-3 text-sm whitespace-pre-wrap">
                    {formatResponseValue(response.value)}
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
