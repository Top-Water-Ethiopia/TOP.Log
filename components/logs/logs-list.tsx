"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Keyboard,
  Maximize2,
  Minimize2,
  PhoneCall,
  Plus,
  Undo2,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { buildLogsPageHrefFromState } from "@/lib/logs-page-filters"
import { useLogsPageState } from "@/hooks/use-logs-page-state"
import type { LogEntry } from "@/lib/logs/types"
import { cn } from "@/lib/utils"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useToast } from "@/hooks/use-toast"
import { EntryKindBadge } from "@/components/logs/entry-kind-badge"
import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"

export interface FlattenedLogItem {
  id: string
  type: "header" | "dateHeader" | "row"
  userId: string
  userName: string
  date?: string
  data?: LogEntry
  summary?: {
    totalLogs: number
    lastSubmission: string
  }
}

interface LogsListProps {
  canViewDepartmentLogs?: boolean
  emptyActionHref?: string | null
  emptyActionLabel?: string
  emptyDescription: string
  emptyTitle: string
  entryKindConfigs?: ScopeEntryKind[]
  flattenedItems?: FlattenedLogItem[]
  logs: LogEntry[]
}

function deptEntryKindKey(departmentId: string, entryKind: string) {
  return `${departmentId}:${entryKind}`
}

function professionEntryKindKey(departmentId: string, professionRoleId: string, entryKind: string) {
  return `${departmentId}:${professionRoleId}:${entryKind}`
}

export function LogsList({
  canViewDepartmentLogs = false,
  emptyActionHref,
  emptyActionLabel = "Create New Log",
  emptyDescription,
  emptyTitle,
  entryKindConfigs = [],
  flattenedItems = [],
  logs,
}: LogsListProps) {
  const router = useRouter()
  const { state } = useLogsPageState()
  const { toast } = useToast()
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})
  const [previousExpandedState, setPreviousExpandedState] = useState<Record<string, boolean>>({})
  const parentRef = useRef<HTMLDivElement>(null)

  const entryKindIndex = useMemo(() => {
    const deptWidePersonal = new Map<string, ScopeEntryKind>()
    const deptReport = new Map<string, ScopeEntryKind>()
    const professionPersonal = new Map<string, ScopeEntryKind>()
    const professionHasAnyOverride = new Set<string>()

    entryKindConfigs.forEach((config) => {
      if (!config.is_active || !config.is_available) return
      if (!config.department_id) return

      const scopeType = config.scope_type

      if (scopeType === "dept_report") {
        deptReport.set(deptEntryKindKey(config.department_id, config.entry_kind), config)
        return
      }

      if (scopeType === "profession_personal" && config.profession_role_id) {
        professionHasAnyOverride.add(`${config.department_id}:${config.profession_role_id}`)
        professionPersonal.set(
          professionEntryKindKey(config.department_id, config.profession_role_id, config.entry_kind),
          config
        )
        return
      }

      // Default/fallback: dept-wide personal
      deptWidePersonal.set(deptEntryKindKey(config.department_id, config.entry_kind), config)
    })

    return { deptWidePersonal, deptReport, professionPersonal, professionHasAnyOverride }
  }, [entryKindConfigs])

  const resolveEntryKindConfig = (log: LogEntry | undefined) => {
    if (!log?.department_id || !log.entry_kind) return undefined

    const reportKind = (log.report_kind || "personal").toLowerCase()
    if (reportKind === "department" || reportKind === "mixed") {
      return entryKindIndex.deptReport.get(deptEntryKindKey(log.department_id, log.entry_kind))
    }

    if (log.subject_profession_id) {
      const overrideKey = `${log.department_id}:${log.subject_profession_id}`
      if (entryKindIndex.professionHasAnyOverride.has(overrideKey)) {
        return entryKindIndex.professionPersonal.get(
          professionEntryKindKey(log.department_id, log.subject_profession_id, log.entry_kind)
        )
      }
    }

    return entryKindIndex.deptWidePersonal.get(deptEntryKindKey(log.department_id, log.entry_kind))
  }

  const shouldShowAgentName = (log: LogEntry | undefined) => {
    const { name } = getAgentDisplayParts(log)
    if (!name) return false
    if (log.entry_kind === "agent_call") return true
    const config = resolveEntryKindConfig(log)
    return !!config?.supports_assigned_agent
  }

  const getAgentDisplayParts = (log: LogEntry | undefined) => {
    const snapshot = log?.subject_agent_snapshot
    const name = snapshot?.name || log?.subject_agent_name || null
    const location = snapshot?.location || null
    return { location, name }
  }

  const isSingleDepartmentContext = useMemo(() => {
    if (state.departmentId) return true
    const uniqueDepartmentIds = new Set(
      (logs || []).map((log) => log.department_id).filter((id): id is string => typeof id === "string" && id.length > 0)
    )
    return uniqueDepartmentIds.size === 1
  }, [logs, state.departmentId])

  const visibleItems = useMemo(() => {
    // Derived visible list ensures virtualization indices stay consistent during collapse
    return flattenedItems.filter((item) => item.type === "header" || expandedUsers[item.userId] !== false)
  }, [flattenedItems, expandedUsers])

  const hasDateHeaders = useMemo(() => flattenedItems.some((item) => item.type === "dateHeader"), [flattenedItems])

  const DATE_HEADER_HEIGHT = 44
  const USER_HEADER_HEIGHT = 64
  const ROW_HEIGHT = 140

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const type = visibleItems[index].type
      if (type === "header") return USER_HEADER_HEIGHT
      if (type === "dateHeader") return DATE_HEADER_HEIGHT
      return ROW_HEIGHT
    },
    overscan: 5,
  })

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }))
  }

  const visibleUserIds = useMemo(() => {
    return flattenedItems.filter((item) => item.type === "header").map((item) => item.userId)
  }, [flattenedItems])

  const allExpanded = useMemo(() => {
    return visibleUserIds.every((userId) => expandedUsers[userId] !== false)
  }, [visibleUserIds, expandedUsers])

  const toggleAll = () => {
    const shouldExpand = !allExpanded
    setPreviousExpandedState(expandedUsers)

    setExpandedUsers((prev) => {
      const newState = { ...prev }
      visibleUserIds.forEach((userId) => {
        newState[userId] = shouldExpand
      })
      return newState
    })

    // Show toast with undo option
    toast({
      title: shouldExpand ? "All expanded" : "All collapsed",
      description: `${visibleUserIds.length} user${visibleUserIds.length !== 1 ? "s" : ""} ${shouldExpand ? "expanded" : "collapsed"}`,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setExpandedUsers(previousExpandedState)
            toast({
              title: "Undone",
              description: "Previous state restored",
            })
          }}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo
        </Button>
      ),
    })
  }

  const scrollKey = useMemo(() => {
    if (typeof window === "undefined") return "logs:scroll"
    const url = new URL(window.location.href)
    url.searchParams.delete("selectedLogId")
    url.searchParams.delete("nextCursorDate")
    url.searchParams.delete("nextCursorId")
    return `logs:scroll:${url.pathname}?${url.searchParams.toString()}`
  }, [state.date, state.departmentId, state.searchName, state.view, state.professionRoleId, state.entryKind, state.month])

  const saveScrollPosition = () => {
    try {
      const el = parentRef.current
      if (!el) return
      window.sessionStorage.setItem(scrollKey, String(el.scrollTop))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Restore scroll position after navigation (e.g., opening/closing preview).
    try {
      const el = parentRef.current
      if (!el) return
      const raw = window.sessionStorage.getItem(scrollKey)
      if (!raw) return
      const value = Number.parseInt(raw, 10)
      if (!Number.isFinite(value)) return
      // Defer until after paint so virtualization has laid out.
      requestAnimationFrame(() => {
        el.scrollTop = value
      })
    } catch {
      // ignore
    }
  }, [scrollKey, state.selectedLogId])

  const undo = () => {
    setExpandedUsers(previousExpandedState)
    toast({
      title: "Undone",
      description: "Previous state restored",
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canViewDepartmentLogs || visibleUserIds.length < 2) return

      // Cmd/Ctrl + Shift + E to expand all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "e") {
        e.preventDefault()
        if (!allExpanded) toggleAll()
      }

      // Cmd/Ctrl + Shift + C to collapse all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault()
        if (allExpanded) toggleAll()
      }

      // Cmd/Ctrl + Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewDepartmentLogs, visibleUserIds.length, allExpanded, previousExpandedState])

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="text-muted-foreground/50 h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">{emptyTitle}</h3>
          <p className="text-muted-foreground mt-1 text-center text-sm">{emptyDescription}</p>
          {emptyActionHref ? (
            <Button className="mt-4" asChild>
              <Link href={emptyActionHref}>
                <Plus className="mr-2 h-4 w-4" />
                {emptyActionLabel}
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      {canViewDepartmentLogs && visibleUserIds.length >= 2 ? (
        <div className="bg-background/95 sticky top-0 z-30 mb-2 rounded-md border p-2 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {visibleUserIds.length} user{visibleUserIds.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                aria-label={allExpanded ? "Collapse all users" : "Expand all users"}
                className="transition-all duration-200 active:scale-95"
                title="Keyboard: ⌘⇧E to expand, ⌘⇧C to collapse, ⌘Z to undo"
              >
                <span className="hidden sm:inline">
                  {allExpanded ? (
                    <>
                      <Minimize2 className="mr-2 h-4 w-4" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Expand All
                    </>
                  )}
                </span>
                <span className="sm:hidden">
                  {allExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </span>
              </Button>
              <div className="text-muted-foreground hidden items-center gap-1 text-xs md:flex">
                <Keyboard className="h-3 w-3" />
                <span className="hidden lg:inline">⌘⇧E</span>
                <span className="lg:hidden">⌘E</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div ref={parentRef} className="max-h-[800px] overflow-auto rounded-md border">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = visibleItems[virtualRow.index]
            if (!item) return null

            const isHeader = item.type === "header"
            const isDateHeader = item.type === "dateHeader"
            const isExpanded = expandedUsers[item.userId] !== false
            const previousItem = virtualRow.index > 0 ? visibleItems[virtualRow.index - 1] : null

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={cn("px-4", isHeader && "bg-background/80 sticky top-0 z-20 border-y backdrop-blur-sm")}
              >
                {isHeader ? (
                  <div
                    className="flex h-full cursor-pointer items-center justify-between py-2"
                    onClick={() => toggleUser(item.userId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                        <User className="text-primary h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{item.userName}</h3>
                        <p className="text-muted-foreground text-xs">
                          {item.summary?.totalLogs} submission{item.summary?.totalLogs !== 1 ? "s" : ""}
                          {item.summary?.lastSubmission && ` • Last: ${item.summary.lastSubmission}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : isDateHeader ? (
                  <div
                    className={cn("flex h-full items-center", previousItem?.type === "row" ? "pt-3" : "pt-2", "pb-0")}
                  >
                    <div className="px-3 sm:px-4">
                      <div className="bg-muted/20 border-primary/40 text-muted-foreground supports-[backdrop-filter]:bg-background/70 mb-1 flex items-center rounded-md border-l-2 px-3 py-1.5 text-xs font-medium tracking-wide uppercase backdrop-blur">
                        {item.date
                          ? new Date(item.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(previousItem?.type === "dateHeader" ? "pt-1 pb-2" : "py-2")}>
                    <Card
                      className="cursor-pointer overflow-hidden transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-md active:scale-[0.99] motion-reduce:transition-none"
                      onClick={() => {
                        saveScrollPosition()
                        const href = buildLogsPageHrefFromState({
                          date: state.date || "",
                          departmentId: state.departmentId || "",
                          month: state.month,
                          page: state.page,
                          searchName: state.searchName || "",
                          selectedLogId: item.data?.id || "",
                          view: state.view,
                          nextCursorDate: state.nextCursorDate || "",
                          nextCursorId: state.nextCursorId || "",
                          professionRoleId: state.professionRoleId || "",
                          entryKind: state.entryKind || "",
                        })
                        router.push(href)
                      }}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                          <div
                            className={cn(
                              "bg-primary/10 hidden h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg sm:flex",
                              hasDateHeaders && "sm:hidden"
                            )}
                          >
                            <span className="text-primary text-xs font-medium uppercase">
                              {item.data?.date
                                ? new Date(item.data.date).toLocaleDateString("en-US", { month: "short" })
                                : ""}
                            </span>
                            <span className="text-primary text-lg font-bold">
                              {item.data?.date ? new Date(item.data.date).getDate() : ""}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className={cn("hidden items-center gap-2 sm:flex", hasDateHeaders && "sm:hidden")}>
                              <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                              <span className="text-sm font-medium">
                                {item.data?.date ? formatDateHuman(item.data.date) : ""}
                              </span>
                            </div>
                            {(() => {
                              const log = item.data
                              if (!log) return null

                              const { name: agentName, location: agentLocation } = getAgentDisplayParts(log)
                              const isAgentRelated = shouldShowAgentName(log)
                              const showAgentPrimary = isSingleDepartmentContext && isAgentRelated && !!agentName

                              return (
                                <div className="hidden items-center gap-2 sm:mt-1 sm:flex sm:leading-tight">
                                  {showAgentPrimary ? (
                                    <>
                                      <PhoneCall className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                                      <span
                                        className="max-w-[18rem] truncate text-sm font-medium"
                                        title={agentName || undefined}
                                      >
                                        {agentName}
                                      </span>
                                      {agentLocation ? (
                                        <>
                                          <span className="text-muted-foreground text-sm">•</span>
                                          <span
                                            className="max-w-[16rem] truncate text-sm text-slate-600"
                                            title={agentLocation}
                                          >
                                            {agentLocation}
                                          </span>
                                        </>
                                      ) : null}
                                    </>
                                  ) : (
                                    <>
                                      <Building2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                                      <span
                                        className="text-sm font-medium sm:font-normal"
                                        title={log.department_name || undefined}
                                      >
                                        {log.department_name}
                                      </span>
                                      {isAgentRelated && agentName ? (
                                        <>
                                          <span className="text-muted-foreground text-sm">•</span>
                                          <span
                                            className="max-w-[14rem] truncate text-sm text-slate-600"
                                            title={agentName}
                                          >
                                            {agentName}
                                          </span>
                                        </>
                                      ) : null}
                                    </>
                                  )}
                                  <span className="text-muted-foreground text-sm">·</span>
                                  <span className="text-sm text-slate-600">
                                    {log.response_count} response{log.response_count !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              )
                            })()}
                            <div className="sr-only sm:block">
                              {item.data?.response_count} response{item.data?.response_count !== 1 ? "s" : ""}
                            </div>
                            {(() => {
                              const log = item.data
                              if (!log) return null

                              const { name: agentName, location: agentLocation } = getAgentDisplayParts(log)
                              const isAgentRelated = shouldShowAgentName(log)
                              const showAgentPrimary = isSingleDepartmentContext && isAgentRelated && !!agentName

                              // Keep list rows stable-height: only include location inline if it’s short enough.
                              const canShowLocationInline = !!agentLocation && agentLocation.length <= 24

                              const responseLabel = `${log.response_count} response${log.response_count !== 1 ? "s" : ""}`

                              return (
                                <>
                                  <div className="mt-1 flex items-center gap-2 text-sm sm:hidden">
                                    {showAgentPrimary ? (
                                      <>
                                        <PhoneCall className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                                        <span
                                          className="max-w-[16rem] truncate font-medium"
                                          title={agentName || undefined}
                                        >
                                          {agentName}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Building2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                                        <span
                                          className="max-w-[16rem] truncate font-medium"
                                          title={log.department_name || undefined}
                                        >
                                          {log.department_name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 sm:hidden">
                                    {showAgentPrimary ? (
                                      <>
                                        {canShowLocationInline && agentLocation ? (
                                          <>
                                            <span className="truncate" title={agentLocation || undefined}>
                                              {agentLocation}
                                            </span>
                                            <span className="text-muted-foreground">·</span>
                                          </>
                                        ) : null}
                                        {canShowLocationInline && agentLocation ? null : (
                                          <span className="text-muted-foreground">·</span>
                                        )}
                                        <span>{responseLabel}</span>
                                      </>
                                    ) : (
                                      <>
                                        {isAgentRelated && agentName ? (
                                          <>
                                            <span className="truncate" title={agentName || undefined}>
                                              {agentName}
                                            </span>
                                            <span className="text-muted-foreground">·</span>
                                          </>
                                        ) : null}
                                        {isAgentRelated && agentName ? null : (
                                          <span className="text-muted-foreground">·</span>
                                        )}
                                        <span>{responseLabel}</span>
                                      </>
                                    )}
                                  </div>
                                </>
                              )
                            })()}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2 self-start pt-1 sm:self-start sm:pt-1">
                            <div className="flex h-6 items-start justify-end">
                              <EntryKindBadge
                                entryKind={item.data?.entry_kind}
                                config={resolveEntryKindConfig(item.data)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-sm font-medium"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveScrollPosition()
                                const href = buildLogsPageHrefFromState({
                                  date: state.date || "",
                                  departmentId: state.departmentId || "",
                                  month: state.month,
                                  page: state.page,
                                  searchName: state.searchName || "",
                                  selectedLogId: item.data?.id || "",
                                  view: state.view,
                                  nextCursorDate: state.nextCursorDate || "",
                                  nextCursorId: state.nextCursorId || "",
                                  professionRoleId: state.professionRoleId || "",
                                  entryKind: state.entryKind || "",
                                })
                                router.push(href)
                              }}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
