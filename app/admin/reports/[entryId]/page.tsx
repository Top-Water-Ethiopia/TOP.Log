"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"
import { ReportDetailsSkeleton } from "@/components/skeletons/report-details-skeleton"
import { format, parseISO } from "date-fns"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

interface UserProfile {
  user_id: string
  name: string
  email: string
  role_name: string
  department_name: string | null
}

interface EnrichedEntry {
  id: string
  user_id: string
  date: string
  created_at: string
  updated_at: string
  version: number
  metadata: unknown
  custom_responses: CustomResponse[]
  user_profile: UserProfile | null
}

export default function AdminReportDetailsPage() {
  const router = useRouter()
  const params = useParams<{ entryId: string }>()
  const entryId = params?.entryId

  const { user, isLoading } = useSupabaseAuth()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const [entry, setEntry] = useState<EnrichedEntry | null>(null)
  const [isEntryLoading, setIsEntryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (!canAccessAdmin) {
      router.push("/")
      return
    }
  }, [isLoading, user, canAccessAdmin, router, rbacChecked, rbacLoading])

  useEffect(() => {
    if (!entryId) return
    if (isLoading) return
    if (!user) return
    if (!rbacChecked || rbacLoading) return
    if (!canAccessAdmin) return

    // Avoid refetching if we already have the data for this entryId
    if (entry?.id === entryId) {
      return
    }

    const load = async () => {
      try {
        setIsEntryLoading(true)
        setError(null)

        const res = await fetch(`/api/admin/captain-log-entries/${entryId}`)
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        setEntry(data.entry || null)
      } catch (e) {
        setEntry(null)
        setError(e instanceof Error ? e.message : "Failed to load entry")
      } finally {
        setIsEntryLoading(false)
      }
    }

    load()
  }, [entryId, isLoading, user, canAccessAdmin, rbacChecked, rbacLoading, entry?.id])

  if (isLoading || rbacLoading || !user) {
    return <ReportDetailsSkeleton />
  }

  if (isEntryLoading) {
    return <ReportDetailsSkeleton />
  }

  if (error) {
    return (
      <div className="bg-background min-h-screen">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => router.push("/admin/reports")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to All Entries
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Unable to load report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm">{error}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="bg-background min-h-screen">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => router.push("/admin/reports")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to All Entries
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Report not found</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const name = entry.user_profile?.name || "Unknown User"
  const email = entry.user_profile?.email || ""
  const roleName = entry.user_profile?.role_name || ""
  const departmentName = entry.user_profile?.department_name || ""

  const dateLabel = (() => {
    try {
      return entry.date ? format(parseISO(entry.date), "MMM d, yyyy") : ""
    } catch {
      return entry.date || ""
    }
  })()

  const timeLabel = (() => {
    try {
      return entry.created_at ? format(parseISO(entry.created_at), "h:mm a") : ""
    } catch {
      return ""
    }
  })()

  const handleDelete = async () => {
    if (!entryId) return
    if (isDeleting) return

    try {
      setIsDeleting(true)
      await apiFetch(`/api/admin/captain-log-entries/${entryId}`, { method: "DELETE" })
      toast.success("Report deleted")
      router.push("/admin/reports")
      router.refresh()
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to delete report"))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={() => router.push("/admin/reports")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to All Entries
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Report
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete report?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this report and its responses. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Individual Report Details</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{name}</CardTitle>
            {email ? <div className="text-muted-foreground text-sm">{email}</div> : null}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {roleName ? <Badge variant="secondary">{roleName}</Badge> : null}
            {departmentName ? <Badge variant="secondary">{departmentName}</Badge> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Report ID:</div>
                <div className="font-medium">{entry.id}</div>
              </div>
              {dateLabel ? (
                <div>
                  <div className="text-muted-foreground">Date:</div>
                  <div className="font-medium">{dateLabel}</div>
                </div>
              ) : null}
              {timeLabel ? (
                <div>
                  <div className="text-muted-foreground">Time:</div>
                  <div className="font-medium">{timeLabel}</div>
                </div>
              ) : null}
              <div>
                <div className="text-muted-foreground">Status:</div>
                <div className="font-medium text-green-600">Submitted</div>
              </div>
              <div>
                <div className="text-muted-foreground">Submitted By:</div>
                <div className="font-medium">{name}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Responses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const responses = (entry.custom_responses || []).filter((r) => {
                  const v = r.value
                  if (v === null || v === undefined) return false
                  if (typeof v === "string" && v.trim() === "") return false
                  if (Array.isArray(v) && v.length === 0) return false
                  return true
                })

                if (responses.length === 0) {
                  return <div className="text-muted-foreground text-sm">No responses found.</div>
                }

                return responses.map((r, idx) => (
                  <div key={`${r.question_id}-${idx}`} className="space-y-1">
                    <div className="font-semibold">{`Q${idx + 1}: ${r.question_label || r.question_key}`}</div>
                    <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {Array.isArray(r.value) ? r.value.join(", ") : String(r.value)}
                    </div>
                    {idx < responses.length - 1 ? <div className="bg-border mt-3 h-px" /> : null}
                  </div>
                ))
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
