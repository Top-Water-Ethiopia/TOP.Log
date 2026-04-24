"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { hashSnapshot } from "@/lib/report-edit/snapshot"
import { canEditReport } from "@/lib/report-edit/can-edit-report"
import { toast } from "sonner"

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
  entry_date?: string | null
  questions_snapshot?: any[] | null
  questions_snapshot_version?: number | null
  questions_snapshot_hash?: string | null
  edit_window_days_applied?: number | null
  is_editable_applied?: boolean | null
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
  const [etag, setEtag] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editResponses, setEditResponses] = useState<Record<string, unknown>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  const loadReport = useCallback(async (id: string) => {
    try {
      setLoading(true)
      setLoadError(null)
      const res = await fetch(`/api/reports/${id}`)
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
      setEtag(res.headers.get("ETag"))
      setReport((json.data || {}) as ReportEntry)
    } catch (error) {
      console.error("Failed to load report:", error)
      setLoadError(error instanceof Error ? error.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !reportId) return
    if (report?.id === reportId) return
    void loadReport(reportId)
  }, [loadReport, report?.id, reportId, user])

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

  const canEdit = useMemo(() => {
    if (!report) return false
    if (!user) return false

    const submittedBy = report.user_id
    if (submittedBy !== user.id) return false

    const editCheck = canEditReport(
      {
        entry_date: report.entry_date || report.date || null,
        edit_window_days_applied: report.edit_window_days_applied ?? null,
        is_editable_applied: report.is_editable_applied === true,
        questions_snapshot: report.questions_snapshot ?? null,
        submitted_by_user_id: report.user_id,
      },
      user.id
    )

    return editCheck.can_edit
  }, [report, user])

  useEffect(() => {
    if (!report) return
    if (!isEditing) return

    const initial: Record<string, unknown> = {}
    ;(report.questions_snapshot || []).forEach((q: any) => {
      const key = typeof q?.key === "string" ? q.key : null
      if (!key) return
      initial[key] = ""
    })
    ;(report.custom_responses || []).forEach((r) => {
      if (typeof r.question_key !== "string") return
      initial[r.question_key] = r.value
    })

    setEditResponses(initial)
    setEditErrors({})
  }, [isEditing, report])

  const handleSaveEdit = async () => {
    if (!report) return
    if (!etag) {
      toast.error("Missing report version. Please refresh and try again.")
      return
    }

    // For legacy reports without snapshot, skip snapshot validation
    const hasSnapshot =
      !!report.questions_snapshot && !!report.questions_snapshot_hash && !!report.questions_snapshot_version
    if (!hasSnapshot) {
      toast.warning("This is a legacy report without snapshot protection. Edits will use current question schema.")
    }

    setIsSaving(true)
    setEditErrors({})
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now())

      let payloadResponses: any[] = []
      if (hasSnapshot) {
        payloadResponses = (report.questions_snapshot || []).map((q: any) => {
          const key = typeof q?.key === "string" ? q.key : ""
          return {
            question_id: typeof q?.id === "string" ? q.id : `snap_${key}`,
            question_key: key,
            question_label: typeof q?.label === "string" ? q.label : null,
            question_type: typeof q?.type === "string" ? q.type : null,
            value: editResponses[key],
          }
        })

        // Client-side guard: ensure snapshot hash matches what we render.
        const computedHash = await hashSnapshot(report.questions_snapshot)
        if (computedHash !== report.questions_snapshot_hash) {
          toast.error("This report's schema changed unexpectedly. Please refresh.")
          return
        }
      } else {
        // Legacy report: use current editResponses as payload
        payloadResponses = Object.entries(editResponses).map(([key, value]) => ({
          question_id: `legacy_${key}`,
          question_key: key,
          question_label: key,
          question_type: "text",
          value,
        }))
      }

      const body: any = {
        responses: payloadResponses,
      }

      if (hasSnapshot) {
        body.snapshot_version = report.questions_snapshot_version
        body.snapshot_hash = report.questions_snapshot_hash
      }

      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": etag,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          // Fetch fresh report
          const freshRes = await fetch(`/api/reports/${report.id}`)
          const freshJson = await freshRes.json().catch(() => ({}))

          if (!freshRes.ok || !freshJson.data) {
            toast.error("Report was modified elsewhere. Please refresh.")
            await loadReport(report.id)
            setIsEditing(false)
            return
          }

          const fresh = freshJson.data as ReportEntry

          if (!fresh.questions_snapshot) {
            toast.error("Report was modified elsewhere. Please refresh.")
            await loadReport(report.id)
            setIsEditing(false)
            return
          }

          // Build merged responses: schema-aware merge per question key
          const mergedResponses: Record<string, unknown> = {}

          // First, load fresh values from snapshot
          const freshResponses: Record<string, unknown> = {}
          fresh.custom_responses?.forEach((r: any) => {
            if (typeof r?.question_key === "string") {
              freshResponses[r.question_key] = r.value
            }
          })

          // Then, apply user's unsaved changes only for keys they modified
          for (const question of fresh.questions_snapshot) {
            const key = typeof question?.key === "string" ? question.key : null
            if (!key) continue

            // If user modified this field, use their value
            if (editResponses[key] !== undefined && editResponses[key] !== freshResponses[key]) {
              mergedResponses[key] = editResponses[key]
            } else {
              // Otherwise use fresh value
              mergedResponses[key] = freshResponses[key]
            }
          }

          // Update responses state with merged data
          setEditResponses(mergedResponses)

          // Update ETag
          const nextEtag = freshRes.headers.get("ETag")
          if (nextEtag) setEtag(nextEtag)

          toast.error("Report changed elsewhere. Your changes have been merged.")
          return
        }
        const key = typeof json?.key === "string" ? json.key : null
        if (key && typeof json?.error === "string") {
          setEditErrors({ [key]: json.error })
        }
        throw new Error(json?.error || "Failed to save report")
      }

      const nextEtag = res.headers.get("ETag")
      if (nextEtag) setEtag(nextEtag)
      toast.success(json?.no_change ? "No changes to save" : "Report updated")
      setIsEditing(false)
      await loadReport(report.id)
    } catch (error) {
      console.error("Failed to save report edit:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save report")
    } finally {
      setIsSaving(false)
    }
  }

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
          {canEdit ? (
            isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )
          ) : null}
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

          {!report.questions_snapshot && report.is_editable_applied ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-sm">
                  This report was created before edit support was introduced and cannot be edited. The questions used to
                  create this report are no longer available in the system.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {isEditing && report.questions_snapshot && Array.isArray(report.questions_snapshot) ? (
            <div className="space-y-4">
              <div className="text-muted-foreground text-sm">
                Editing uses the question snapshot saved when this report was submitted.
              </div>
              <RoleBasedQuestionFields
                questions={report.questions_snapshot as any}
                responses={editResponses}
                errors={editErrors}
                onChange={(questionKey, value) => {
                  setEditResponses((prev) => ({ ...prev, [questionKey]: value }))
                  setEditErrors((prev) => {
                    if (!prev[questionKey]) return prev
                    const next = { ...prev }
                    delete next[questionKey]
                    return next
                  })
                }}
                renderMode="full"
              />
            </div>
          ) : responses.length === 0 ? (
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
