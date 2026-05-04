import { adminSupabase } from "@/lib/supabase/admin"

export async function getMarketingDepartmentId(): Promise<string | null> {
  // Phase 2: stable identity via departments.slug = 'marketing'
  const { data: row, error } = await adminSupabase
    .from("departments")
    .select("id")
    .eq("slug", "marketing")
    .maybeSingle()

  if (!error && row?.id) return row.id

  // Back-compat fallback (pre-slug deployments)
  const { data: fallbackRows } = await adminSupabase.from("departments").select("id, name").order("name")
  const candidate = (fallbackRows || []).find((d) => String(d.name || "").toLowerCase().includes("marketing"))
  return candidate?.id || null
}

