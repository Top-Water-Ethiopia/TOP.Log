"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSupabaseAuth } from '@/contexts/supabase-auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { ReportDetailsSkeleton } from '@/components/skeletons/report-details-skeleton'
import { format, parseISO } from 'date-fns'

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

interface CustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: any
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
  metadata: any
  custom_responses: CustomResponse[]
  user_profile: UserProfile | null
}

export default function AdminReportDetailsPage() {
  const router = useRouter()
  const params = useParams<{ entryId: string }>()
  const entryId = params?.entryId

  const { user, profile, isLoading } = useSupabaseAuth()

  const [entry, setEntry] = useState<EnrichedEntry | null>(null)
  const [isEntryLoading, setIsEntryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = useMemo(() => {
    const roleId = profile?.role_id
    return roleId === ADMIN_ROLE_ID || roleId === SUPER_ADMIN_ROLE_ID
  }, [profile?.role_id])

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    if (!isAdmin) {
      router.push('/')
      return
    }
  }, [isLoading, user, isAdmin, router])

  useEffect(() => {
    if (!entryId) return
    if (isLoading) return
    if (!user) return
    if (!isAdmin) return

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
        setError(e instanceof Error ? e.message : 'Failed to load entry')
      } finally {
        setIsEntryLoading(false)
      }
    }

    load()
  }, [entryId, isLoading, user, isAdmin])

  if (isLoading || (!user && !isAdmin)) {
    return <ReportDetailsSkeleton />
  }

  if (isEntryLoading) {
    return <ReportDetailsSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => router.push('/admin/reports')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to All Entries
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Unable to load report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">{error}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-background">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => router.push('/admin/reports')} className="gap-2">
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

  const name = entry.user_profile?.name || 'Unknown User'
  const email = entry.user_profile?.email || ''
  const roleName = entry.user_profile?.role_name || ''
  const departmentName = entry.user_profile?.department_name || ''

  const dateLabel = (() => {
    try {
      return entry.date ? format(parseISO(entry.date), 'MMM d, yyyy') : ''
    } catch {
      return entry.date || ''
    }
  })()

  const timeLabel = (() => {
    try {
      return entry.created_at ? format(parseISO(entry.created_at), 'h:mm a') : ''
    } catch {
      return ''
    }
  })()

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/admin/reports')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to All Entries
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Individual Report Details</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{name}</CardTitle>
            {email ? <div className="text-sm text-muted-foreground">{email}</div> : null}
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
              {entry.custom_responses && entry.custom_responses.length > 0 ? (
                entry.custom_responses.map((r, idx) => (
                  <div key={`${r.question_id}-${idx}`} className="space-y-1">
                    <div className="font-semibold">
                      {`Q${idx + 1}: ${r.question_label || r.question_key}`}
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {r.value === null || r.value === undefined || r.value === ''
                        ? 'Not provided'
                        : Array.isArray(r.value)
                          ? r.value.join(', ')
                          : String(r.value)}
                    </div>
                    {idx < entry.custom_responses.length - 1 ? (
                      <div className="h-px bg-border mt-3" />
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No responses found.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
