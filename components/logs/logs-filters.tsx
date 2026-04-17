import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buildLogsPageHref } from "@/lib/logs-page-filters"
import type { LogsViewMode } from "@/lib/logs-page-filters"

interface LogsFiltersProps {
  currentView: LogsViewMode
  date?: string
  departmentId?: string
  departments: Array<{ id: string; name: string }>
  hasFilters: boolean
  isBasicUser: boolean
  month: string
}

export function LogsFilters({
  currentView,
  date,
  departmentId,
  departments,
  hasFilters,
  isBasicUser,
  month,
}: LogsFiltersProps) {
  const clearHref = buildLogsPageHref({
    view: currentView,
    month: currentView === "calendar" || currentView === "files" ? month : undefined,
  })

  return (
    <form action="/logs" className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="view" value={currentView} />

      {currentView === "calendar" || currentView === "files" ? <input type="hidden" name="month" value={month} /> : null}
      {currentView === "calendar" && date ? <input type="hidden" name="date" value={date} /> : null}
      {currentView === "files" && date ? <input type="hidden" name="date" value={date} /> : null}

      {currentView === "list" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="logs-date-filter" className="text-sm font-medium">
            Date
          </label>
          <input
            id="logs-date-filter"
            type="date"
            name="date"
            defaultValue={date}
            className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
          />
        </div>
      ) : date ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Selected date</span>
          <div className="flex items-center gap-2">
            <span className="bg-muted text-muted-foreground inline-flex h-9 items-center rounded-md px-3 text-sm">
              {date}
            </span>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link
                href={buildLogsPageHref({
                  view: "calendar",
                  departmentId,
                  month,
                })}
              >
                Clear day
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {!isBasicUser ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="logs-department-filter" className="text-sm font-medium">
            Department
          </label>
          <select
            id="logs-department-filter"
            name="departmentId"
            defaultValue={departmentId}
            className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {hasFilters ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href={clearHref}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  )
}
