"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Calendar, ChevronDown, ChevronRight, Eye, FileText, PhoneCall, Plus, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { buildLogsPageHrefFromState } from "@/lib/logs-page-filters"
import { useLogsPageState } from "@/hooks/use-logs-page-state"
import type { LogEntry } from "@/lib/logs/types"
import { cn } from "@/lib/utils"
import { useVirtualizer } from "@tanstack/react-virtual"

export interface FlattenedLogItem {
  id: string
  type: "header" | "row"
  userId: string
  userName: string
  data?: LogEntry
  summary?: {
    totalLogs: number
    lastSubmission: string
  }
}

interface LogsListProps {
  emptyActionHref?: string | null
  emptyActionLabel?: string
  emptyDescription: string
  emptyTitle: string
  flattenedItems?: FlattenedLogItem[]
  logs: LogEntry[]
}

export function LogsList({
  emptyActionHref,
  emptyActionLabel = "Create New Log",
  emptyDescription,
  emptyTitle,
  flattenedItems = [],
  logs,
}: LogsListProps) {
  const router = useRouter()
  const { state } = useLogsPageState()
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})
  const parentRef = useRef<HTMLDivElement>(null)

  const visibleItems = useMemo(() => {
    // Derived visible list ensures virtualization indices stay consistent during collapse
    return flattenedItems.filter((item) => item.type === "header" || expandedUsers[item.userId] !== false)
  }, [flattenedItems, expandedUsers])

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (visibleItems[index].type === "header" ? 64 : 140),
    overscan: 5,
  })

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }))
  }

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
          const isExpanded = expandedUsers[item.userId] !== false

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
              ) : (
                <div className="py-2">
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-4">
                        <div className="bg-primary/10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg">
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
                          <div className="flex items-center gap-2">
                            <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-sm font-medium">
                              {item.data?.date ? formatDateHuman(item.data.date) : ""}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-muted-foreground text-sm">{item.data?.department_name}</span>
                          </div>
                          {item.data?.entry_kind === "agent_call" && item.data.subject_agent_name ? (
                            <div className="mt-2 flex items-center gap-2">
                              <PhoneCall className="text-muted-foreground h-3.5 w-3.5" />
                              <span className="text-sm font-medium">{item.data.subject_agent_name}</span>
                              <Badge variant="outline">Agent Call</Badge>
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-slate-500">
                            {item.data?.response_count} response{item.data?.response_count !== 1 ? "s" : ""}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
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
  )
}
