import Link from "next/link"
import { Building2, Calendar, Eye, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { buildLogsPageHref } from "@/lib/logs-page-filters"
import type { LogsViewMode } from "@/lib/logs-page-filters"
import type { LogEntry } from "@/lib/logs/types"

interface LogsListProps {
  emptyActionHref?: string | null
  emptyActionLabel?: string
  emptyDescription: string
  emptyTitle: string
  logs: LogEntry[]
  previewDate?: string
  previewDepartmentId?: string
  previewMonth?: string
  previewPage?: number
  previewView: LogsViewMode
}

export function LogsList({
  emptyActionHref,
  emptyActionLabel = "Create New Log",
  emptyDescription,
  emptyTitle,
  logs,
  previewDate,
  previewDepartmentId,
  previewMonth,
  previewPage,
  previewView,
}: LogsListProps) {
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
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-4">
              <div className="bg-primary/10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg">
                <span className="text-primary text-xs font-medium uppercase">
                  {new Date(log.date).toLocaleDateString("en-US", { month: "short" })}
                </span>
                <span className="text-primary text-lg font-bold">{new Date(log.date).getDate()}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-sm">{formatDateHuman(log.date)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-sm">{log.department_name}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {log.response_count} response{log.response_count !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    href={buildLogsPageHref({
                      view: previewView,
                      date: previewDate,
                      departmentId: previewDepartmentId,
                      month: previewMonth,
                      page: previewPage,
                      selectedReportId: log.id,
                    })}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    View
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
