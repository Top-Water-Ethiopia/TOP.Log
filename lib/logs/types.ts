export interface LogEntry {
  id: string
  date: string
  department_id: string | null
  department_name: string
  created_at: string | null
  updated_at: string | null
  response_count: number
}

export interface CalendarDaySummary {
  date: string
  entryCount: number
}
