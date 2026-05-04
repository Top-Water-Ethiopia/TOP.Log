"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImageResponsePreview } from "@/components/image-response-preview"
import { ArrowLeft, Calendar, MapPin, Phone } from "lucide-react"
import { format, parseISO } from "date-fns"
import { normalizeImageResponseValue } from "@/lib/image-upload"

type CustomResponse = {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

type ReportEntry = {
  id: string
  user_id: string
  date: string
  entry_kind?: string | null
  created_at: string
  updated_at: string
  custom_responses?: CustomResponse[]
  profile?: {
    name: string
  }
  subject_agent_snapshot?: {
    name?: string | null
    location?: string | null
    phone?: string | null
  } | null
}

export default function ReportViewPage() {
  const { user, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const params = useParams<{ reportId: string }>()
  const reportId = params.reportId

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push("/")
  }

  const [report, setReport] = useState<ReportEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user || !reportId) return

    // Avoid refetching if we already have the data for this reportId
    if (report?.id === reportId) {
      return
    }

    const loadReport = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await fetch(`/api/reports/${reportId}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = json.message || json.error || `HTTP ${res.status}`
          if (res.status === 400) {
            setReport(null)
            setLoadError(String(message))
            return
          }
          if (res.status === 404 || res.status === 403) {
            setReport(null)
            setLoadError(String(message))
            return
          }
          throw new Error(message)
        }
        setReport((json.data || {}) as ReportEntry)
      } catch (error) {
        console.error("Failed to load report:", error)
        setLoadError(error instanceof Error ? error.message : "Failed to load report")
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [user, reportId, report?.id])

  const formatResponseValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "Not provided"
    if (Array.isArray(value)) {
      if (value.length === 0) return "Not provided"
      return value
        .map((v) => {
          // Handle enriched objects with name/label property
          if (typeof v === "object" && v !== null) {
            const name = (v as { name?: unknown }).name
            if (typeof name === "string" && name.trim()) {
              return name
            }
            const label = (v as { label?: unknown }).label
            if (typeof label === "string" && label.trim()) {
              return label
            }
          }
          return String(v)
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

  const renderResponseValue = (response: CustomResponse) => {
    const questionType = response.question_type ?? "text"
    const { value } = response

    if (questionType === "image") {
      const assets = normalizeImageResponseValue(value)
      if (assets.length > 0) {
        return <ImageResponsePreview value={value} />
      }
    }

    return formatResponseValue(value)
  }

  const responses = useMemo(() => {
    return (report?.custom_responses || []).filter((r) => {
      const val = r.value
      if (val === null || val === undefined || val === "") return false
      if (Array.isArray(val) && val.length === 0) return false
      return true
    })
  }, [report])

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24 bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-6 w-48 bg-gray-200/60 dark:bg-gray-800" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32 bg-gray-200/60 dark:bg-gray-800" />
                <Skeleton className="h-16 w-full bg-gray-200/50 dark:bg-gray-800" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Report not found</CardTitle>
            <CardDescription>{loadError || "The requested report could not be found."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Report Details</h1>
            <p className="text-muted-foreground mt-2">Full report view</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.entry_kind === "agent_call" ? <Badge variant="outline">Agent Call</Badge> : null}
          <Badge variant="secondary">{responses.length} responses</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{report.profile?.name || "Unknown User"}</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {(() => {
                  try {
                    return format(parseISO(report.date), "MMMM d, yyyy")
                  } catch {
                    return report.date
                  }
                })()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <div className="text-muted-foreground bg-muted/30 rounded-lg border p-6 text-center">
              No responses for this report.
            </div>
          ) : (
            <div className="space-y-6">
              {responses.map((response, idx) => (
                <div key={`${response.question_id}-${idx}`} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">{response.question_label || response.question_key}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg border p-4 text-sm">
                    {typeof response.question_type === "string" && response.question_type === "image" ? (
                      <div className="not-prose">{renderResponseValue(response)}</div>
                    ) : (
                      <div className="text-muted-foreground whitespace-pre-wrap">{renderResponseValue(response)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
