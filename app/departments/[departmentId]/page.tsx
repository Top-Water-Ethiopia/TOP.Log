"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { CalendarDays, ChevronLeft, ChevronRight, ArrowLeft, ExternalLink } from "lucide-react"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"

type CustomResponse = {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

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
  custom_responses?: CustomResponse[]
}

export default function DepartmentDetailsPage() {
  const departmentsEnabled = isFeatureEnabledClient("DEPARTMENTS")
  const { user, isLoading } = useSupabaseAuth()
  const { rbacLoading, hasPermission } = useRBAC()
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const departmentId = typeof params?.departmentId === "string" ? params.departmentId : ""
  const userId = user?.id

  const canAccessAdmin = hasPermission("admin.system")

  const [members, setMembers] = useState<MemberRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [department, setDepartment] = useState<{
    id: string
    name: string
    description: string | null
    is_active: boolean
  } | null>(null)
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [loadingDepartment, setLoadingDepartment] = useState(true)

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null)
  const [isCalendarSheetOpen, setIsCalendarSheetOpen] = useState(false)
  const [calendarUserSearch, setCalendarUserSearch] = useState("")
  const [calendarSheetMode, setCalendarSheetMode] = useState<"list" | "details">("list")
  const [selectedEntry, setSelectedEntry] = useState<EntryRow | null>(null)

  useEffect(() => {
    if (!departmentsEnabled) return
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [departmentsEnabled, user, isLoading, router])

  useEffect(() => {
    if (!userId) return
    if (!departmentsEnabled) {
      setMembers([])
      setEntries([])
      setDepartment(null)
      setMembersLoaded(false)
      setEntriesLoaded(false)
      setLoadingDepartment(false)
      setLoadingMembers(false)
      setLoadingEntries(false)
      return
    }
    if (isLoading || rbacLoading) return
    const id = departmentId.trim()
    if (!id || id === "undefined" || id === "null") {
      setLoadingDepartment(false)
      setLoadingMembers(false)
      setLoadingEntries(false)
      return
    }

    const loadDepartment = async () => {
      try {
        setLoadingDepartment(true)
        const res = await fetch(`/api/departments/${id}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login")
            return
          }
          if (res.status === 403) {
            toast.error("Access denied")
            router.replace("/departments")
            return
          }
          throw new Error(json.message || json.error || `HTTP ${res.status}`)
        }
        setDepartment(json.data)
      } catch (error) {
        console.error("Failed to load department:", error)
      } finally {
        setLoadingDepartment(false)
      }
    }

    const loadMembers = async () => {
      try {
        setLoadingMembers(true)
        const res = await fetch(`/api/departments/${id}/members`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login")
            return
          }
          if (res.status === 403) {
            toast.error("Access denied")
            router.replace("/departments")
            return
          }
          throw new Error(json.message || json.error || `HTTP ${res.status}`)
        }
        setMembers((json.data || []) as MemberRow[])
      } finally {
        setLoadingMembers(false)
        setMembersLoaded(true)
      }
    }

    const loadEntries = async () => {
      try {
        setLoadingEntries(true)
        const res = await fetch(`/api/departments/${id}/entries`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login")
            return
          }
          if (res.status === 403) {
            toast.error("Access denied")
            router.replace("/departments")
            return
          }
          throw new Error(json.message || json.error || `HTTP ${res.status}`)
        }
        setEntries((json.data || []) as EntryRow[])
      } finally {
        setLoadingEntries(false)
        setEntriesLoaded(true)
      }
    }

    loadDepartment()
    loadMembers()
    loadEntries()
  }, [userId, departmentsEnabled, departmentId, isLoading, rbacLoading, router])

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

  const entriesByDate = useMemo(() => {
    const map = new Map<string, EntryRow[]>()
    for (const e of sortedEntries) {
      const key = String(e.date || "").trim()
      if (!key) continue
      const existing = map.get(key) || []
      existing.push(e)
      map.set(key, existing)
    }
    return map
  }, [sortedEntries])

  const formatResponseValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "Not provided"
    if (Array.isArray(value)) return value.length ? value.map((v) => String(v)).join(", ") : "Not provided"
    if (typeof value === "object") return JSON.stringify(value, null, 2)
    return String(value)
  }

  if (!departmentsEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>This feature is not available yet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canAccessAdmin ? (
              <Button asChild>
                <Link href="/admin/departments">Go to Admin Departments</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/">Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || rbacLoading || !user || (loadingDepartment && !department)) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{department?.name || "Department"}</h2>
        <p className="text-muted-foreground mt-2">Reports and members</p>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {loadingEntries && !entriesLoaded ? (
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader>
                <Skeleton className="h-5 w-44 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-72 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-9 w-9 rounded-full bg-gray-200/60 dark:bg-gray-800" />
                  <Skeleton className="h-6 w-32 bg-gray-200/60 dark:bg-gray-800" />
                  <Skeleton className="h-9 w-9 rounded-full bg-gray-200/60 dark:bg-gray-800" />
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(35)].map((_, i) => (
                    <Skeleton key={i} className="h-[72px] w-full rounded-lg bg-gray-200/50 dark:bg-gray-800" />
                  ))}
                </div>
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
            (() => {
              const today = new Date()
              const monthStart = startOfMonth(calendarMonth)
              const monthEnd = endOfMonth(calendarMonth)
              const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
              const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

              const days: Date[] = []
              for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
                days.push(d)
              }

              const selectedDateKey = selectedCalendarDate ? format(selectedCalendarDate, "yyyy-MM-dd") : null
              const selectedEntries = selectedDateKey ? entriesByDate.get(selectedDateKey) || [] : []

              const selectedEntriesSorted = [...selectedEntries].sort((a, b) => {
                const an = memberNameByUserId.get(a.user_id) || ""
                const bn = memberNameByUserId.get(b.user_id) || ""
                return an.localeCompare(bn)
              })

              const filteredSelectedEntries = (() => {
                const q = calendarUserSearch.trim().toLowerCase()
                if (!q) return selectedEntriesSorted
                return selectedEntriesSorted.filter((e) => {
                  const name = (memberNameByUserId.get(e.user_id) || "Unknown").toLowerCase()
                  const id = String(e.user_id || "").toLowerCase()
                  return name.includes(q) || id.includes(q)
                })
              })()

              return (
                <>
                  <Card className="border border-gray-200 bg-transparent shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="text-muted-foreground h-5 w-5" />
                        Calendar view
                      </CardTitle>
                      <CardDescription>Pick a date to review submitted reports for that day.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, 1)))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold">{format(calendarMonth, "MMMM yyyy")}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                            className="hidden sm:inline-flex"
                          >
                            Today
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, -1)))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-muted-foreground grid grid-cols-7 border-b border-gray-200 text-xs font-semibold">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                          <div key={label} className="py-2 text-center">
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="grid auto-rows-[92px] grid-cols-7 sm:auto-rows-[110px]">
                        {days.map((day) => {
                          const dayKey = format(day, "yyyy-MM-dd")
                          const dayEntries = entriesByDate.get(dayKey) || []
                          const count = dayEntries.length
                          const inMonth = isSameMonth(day, monthStart)
                          const isToday = isSameDay(day, today)
                          const isSelected = selectedCalendarDate ? isSameDay(day, selectedCalendarDate) : false

                          return (
                            <button
                              key={dayKey}
                              type="button"
                              className={
                                "relative border-r border-b border-gray-200 p-2 text-left transition-colors hover:bg-gray-50 focus:outline-hidden " +
                                (inMonth ? "bg-transparent text-gray-900" : "bg-gray-50/60 text-gray-400") +
                                (isToday && !isSelected ? " bg-blue-50/60 ring-1 ring-blue-400/60 ring-inset" : "") +
                                (isSelected ? " bg-blue-50/50 ring-2 ring-blue-500 ring-inset" : "")
                              }
                              onClick={() => {
                                setSelectedCalendarDate(day)
                                setCalendarSheetMode("list")
                                setSelectedEntry(null)
                                setCalendarUserSearch("")
                                setIsCalendarSheetOpen(true)
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div
                                  className={
                                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm " +
                                    (isToday && count > 0
                                      ? "bg-blue-600 font-semibold text-white shadow-sm ring-2 ring-white"
                                      : "text-gray-700")
                                  }
                                >
                                  {format(day, "d")}
                                </div>
                                {isToday && !isSelected ? (
                                  <div className="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] leading-none font-semibold text-blue-700">
                                    Today
                                  </div>
                                ) : null}
                                {count > 0 ? (
                                  <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
                                    {count}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <span className="text-foreground font-semibold">
                            {
                              sortedEntries.filter((e) => {
                                try {
                                  const d = parseISO(e.date)
                                  return (
                                    d.getMonth() === monthStart.getMonth() &&
                                    d.getFullYear() === monthStart.getFullYear()
                                  )
                                } catch {
                                  return false
                                }
                              }).length
                            }
                          </span>{" "}
                          reports this month
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">{sortedEntries.length}</span> total reports
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Sheet
                    open={isCalendarSheetOpen}
                    onOpenChange={(open) => {
                      setIsCalendarSheetOpen(open)
                      if (!open) {
                        setSelectedCalendarDate(null)
                        setCalendarUserSearch("")
                        setCalendarSheetMode("list")
                        setSelectedEntry(null)
                      }
                    }}
                  >
                    <SheetContent className="sm:max-w-md">
                      <SheetHeader>
                        <SheetTitle>
                          {selectedCalendarDate
                            ? `Reports for ${format(selectedCalendarDate, "MMMM d, yyyy")}`
                            : "Reports"}
                        </SheetTitle>
                      </SheetHeader>

                      <div className="px-4 pb-4">
                        {calendarSheetMode === "details" && selectedEntry ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  setCalendarSheetMode("list")
                                  setSelectedEntry(null)
                                }}
                              >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  window.open(`/reports/${selectedEntry.id}`, "_blank")
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                                View Full Report
                              </Button>
                            </div>

                            <div className="space-y-1">
                              <div className="text-lg font-semibold">
                                {memberNameByUserId.get(selectedEntry.user_id) || "Unknown"}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">
                                {(selectedEntry.custom_responses || []).length} responses
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              {(selectedEntry.custom_responses || []).length === 0 ? (
                                <div className="text-muted-foreground bg-muted/30 rounded-lg border p-4 text-sm">
                                  No responses for this report.
                                </div>
                              ) : (
                                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                                  {(selectedEntry.custom_responses || []).map((r, idx) => (
                                    <div key={`${r.question_id}-${idx}`} className="space-y-1">
                                      <div className="font-semibold">{r.question_label || r.question_key}</div>
                                      <div className="text-muted-foreground bg-muted/40 rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {formatResponseValue(r.value)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : selectedCalendarDate && selectedEntriesSorted.length === 0 ? (
                          <div className="text-muted-foreground bg-muted/30 rounded-lg border p-4 text-sm">
                            No reports for this date.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Input
                              value={calendarUserSearch}
                              onChange={(e) => setCalendarUserSearch(e.target.value)}
                              placeholder="Search users..."
                            />

                            {filteredSelectedEntries.length === 0 ? (
                              <div className="text-muted-foreground bg-muted/30 rounded-lg border p-4 text-sm">
                                No users match your search.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {filteredSelectedEntries.map((entry) => {
                                  const name = memberNameByUserId.get(entry.user_id) || "Unknown"
                                  const initials = name
                                    .split(" ")
                                    .filter(Boolean)
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)

                                  return (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      className="hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border bg-white px-4 py-4 text-left shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                      onClick={() => {
                                        setSelectedEntry(entry)
                                        setCalendarSheetMode("details")
                                      }}
                                    >
                                      <div className="flex min-w-0 items-center gap-4">
                                        <div className="bg-muted text-primary/80 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                                          {initials || "??"}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="truncate font-semibold">{name}</div>
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )
            })()
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {loadingMembers && !membersLoaded ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent className="space-y-4">
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
            <div className="space-y-4">
              {sortedMembers.map((m) => (
                <Card key={m.user_id} className="border border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="text-base">{m.profile?.name || "Unknown"}</CardTitle>
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
