import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { buildDepartmentCoalesceOrFilter } from "@/lib/marketing-kpis/agent-calls"

export async function countEntryKindInWindow(params: {
  supabase: SupabaseClient<Database>
  marketingDepartmentId: string
  entryKind: string
  window: { start: string; end: string }
}): Promise<{ value: number; errorMessage?: string }> {
  const { count, error } = await params.supabase
    .from("captain_log_entries")
    .select("id", { count: "exact", head: true })
    .or(buildDepartmentCoalesceOrFilter(params.marketingDepartmentId))
    .eq("entry_kind", params.entryKind)
    .gte("date", params.window.start)
    .lte("date", params.window.end)

  if (error) return { value: 0, errorMessage: error.message }
  return { value: count ?? 0 }
}

