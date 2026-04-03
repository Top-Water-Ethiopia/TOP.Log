export interface AgentSnapshot {
  name: string
  location: string | null
  phone: string | null
}

export interface LogEntry {
  id: string
  date: string
  department_id: string | null
  department_name: string
  created_at: string | null
  updated_at: string | null
  response_count: number
  entry_kind?: "standard" | "agent_call"
  subject_agent_name?: string | null
  subject_agent_snapshot?: AgentSnapshot | null
}

export interface CalendarDaySummary {
  date: string
  entryCount: number
}
