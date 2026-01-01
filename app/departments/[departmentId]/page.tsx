"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"

type MemberRow = {
  user_id: string
  role: string
  is_active: boolean
  profile: {
    user_id: string
    name: string
    role_id: string
    department_id: string | null
    is_active: boolean
  } | null
}

type EntryRow = {
  id: string
  user_id: string
  date: string
  created_at: string
  updated_at: string
  custom_responses?: any[]
}

export default function DepartmentDetailsPage() {
  const { user, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId

  const [members, setMembers] = useState<MemberRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return

    const loadMembers = async () => {
      try {
        setLoadingMembers(true)
        const res = await fetch(`/api/departments/${departmentId}/members`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
        setMembers((json.data || []) as MemberRow[])
      } finally {
        setLoadingMembers(false)
      }
    }

    const loadEntries = async () => {
      try {
        setLoadingEntries(true)
        const res = await fetch(`/api/departments/${departmentId}/entries`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
        setEntries((json.data || []) as EntryRow[])
      } finally {
        setLoadingEntries(false)
      }
    }

    loadMembers()
    loadEntries()
  }, [user?.id, departmentId])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const an = a.profile?.name || ""
      const bn = b.profile?.name || ""
      return an.localeCompare(bn)
    })
  }, [members])

  const memberNameByUserId = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m) => {
      if (!m.user_id) return
      const name = m.profile?.name
      if (name) map.set(m.user_id, name)
    })
    return map
  }, [members])

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [entries])

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
        <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department</h1>
          <p className="text-muted-foreground mt-2">Reports and members</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/departments")}>Back</Button>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {loadingEntries ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </CardContent>
            </Card>
          ) : sortedEntries.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No reports</CardTitle>
                <CardDescription>No submitted reports found for this department.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((e) => {
                const dateLabel = (() => {
                  try {
                    return e.date ? format(parseISO(e.date), "MMM d, yyyy") : ""
                  } catch {
                    return e.date
                  }
                })()

                const authorName = memberNameByUserId.get(e.user_id) || "Unknown"

                return (
                  <Card key={e.id} className="border border-gray-200 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle className="text-base">{dateLabel || "Report"}</CardTitle>
                        <CardDescription className="break-all">
                          {authorName} · {e.user_id}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{(e.custom_responses || []).length} responses</Badge>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {loadingMembers ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
                ))}
              </CardContent>
            </Card>
          ) : sortedMembers.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No members</CardTitle>
                <CardDescription>No members found for this department.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedMembers.map((m) => (
                <Card key={m.user_id} className="border border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">{m.profile?.name || "Unknown"}</CardTitle>
                      <CardDescription className="break-all">{m.user_id}</CardDescription>
                    </div>
                    <Badge variant="secondary">{m.role}</Badge>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
