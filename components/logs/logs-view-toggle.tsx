import Link from "next/link"
import { CalendarDays, Files, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildLogsPageHref } from "@/lib/logs-page-filters"
import type { LogsViewMode } from "@/lib/logs-page-filters"
import { cn } from "@/lib/utils"

interface LogsViewToggleProps {
  currentView: LogsViewMode
  date?: string
  departmentId?: string
  month: string
}

export function LogsViewToggle({ currentView, date, departmentId, month }: LogsViewToggleProps) {
  const listHref = buildLogsPageHref({
    view: "list",
    date,
    departmentId,
  })

  const calendarHref = buildLogsPageHref({
    view: "calendar",
    date,
    departmentId,
    month,
  })

  const filesHref = buildLogsPageHref({
    view: "files",
    date,
    departmentId,
    month,
  })

  return (
    <div className="bg-muted flex items-center rounded-lg p-1">
      <Link href={listHref}>
        <Button
          variant={currentView === "list" ? "secondary" : "ghost"}
          size="sm"
          aria-current={currentView === "list" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            currentView === "list" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <List className="h-4 w-4" />
          List
        </Button>
      </Link>
      <Link href={calendarHref}>
        <Button
          variant={currentView === "calendar" ? "secondary" : "ghost"}
          size="sm"
          aria-current={currentView === "calendar" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            currentView === "calendar" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar
        </Button>
      </Link>
      <Link href={filesHref}>
        <Button
          variant={currentView === "files" ? "secondary" : "ghost"}
          size="sm"
          aria-current={currentView === "files" ? "page" : undefined}
          className={cn(
            "gap-2 transition-colors",
            currentView === "files" ? "text-foreground font-semibold shadow-sm" : "text-muted-foreground"
          )}
        >
          <Files className="h-4 w-4" />
          Files
        </Button>
      </Link>
    </div>
  )
}
