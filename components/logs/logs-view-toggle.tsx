"use client"

import Link from "next/link"
import { CalendarDays, Files, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildLogsPageHrefFromState } from "@/lib/logs-page-filters"
import { useLogsPageState } from "@/hooks/use-logs-page-state"
import { cn } from "@/lib/utils"

// View compatibility map for cursor preservation
const VIEW_COMPATIBILITY: Record<string, string[]> = {
  list: ["list"],
  calendar: ["calendar"],
  files: ["files"],
}

function isCursorCompatible(fromView: string, toView: string): boolean {
  return VIEW_COMPATIBILITY[fromView]?.includes(toView) ?? false
}

export function LogsViewToggle() {
  const { state } = useLogsPageState()

  const listHref = buildLogsPageHrefFromState({
    date: state.date || "",
    departmentId: state.departmentId || "",
    month: state.month,
    page: state.page,
    searchName: state.searchName || "",
    selectedLogId: state.selectedLogId || "",
    view: "list",
    nextCursorDate: isCursorCompatible(state.view, "list") ? state.nextCursorDate || "" : "",
    nextCursorId: isCursorCompatible(state.view, "list") ? state.nextCursorId || "" : "",
  })

  const calendarHref = buildLogsPageHrefFromState({
    date: state.date || "",
    departmentId: state.departmentId || "",
    month: state.month,
    page: state.page,
    searchName: state.searchName || "",
    selectedLogId: state.selectedLogId || "",
    view: "calendar",
    nextCursorDate: isCursorCompatible(state.view, "calendar") ? state.nextCursorDate || "" : "",
    nextCursorId: isCursorCompatible(state.view, "calendar") ? state.nextCursorId || "" : "",
  })

  const filesHref = buildLogsPageHrefFromState({
    date: state.date || "",
    departmentId: state.departmentId || "",
    month: state.month,
    page: state.page,
    searchName: state.searchName || "",
    selectedLogId: state.selectedLogId || "",
    view: "files",
    nextCursorDate: isCursorCompatible(state.view, "files") ? state.nextCursorDate || "" : "",
    nextCursorId: isCursorCompatible(state.view, "files") ? state.nextCursorId || "" : "",
  })

  return (
    <div className="bg-muted flex items-center rounded-lg p-1">
      <Link href={listHref}>
        <Button
          variant={state.view === "list" ? "secondary" : "ghost"}
          size="sm"
          aria-current={state.view === "list" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            state.view === "list" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <List className="h-4 w-4" />
          List
        </Button>
      </Link>
      <Link href={calendarHref}>
        <Button
          variant={state.view === "calendar" ? "secondary" : "ghost"}
          size="sm"
          aria-current={state.view === "calendar" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            state.view === "calendar" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar
        </Button>
      </Link>
      <Link href={filesHref}>
        <Button
          variant={state.view === "files" ? "secondary" : "ghost"}
          size="sm"
          aria-current={state.view === "files" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            state.view === "files" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <Files className="h-4 w-4" />
          Files
        </Button>
      </Link>
    </div>
  )
}
