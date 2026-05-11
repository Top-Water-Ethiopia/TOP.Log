/** @jest-environment node */
import { createClient } from "@supabase/supabase-js"

function env(name: string) {
  return (process.env[name] || "").trim()
}

function buildDepartmentCoalesceOrFilter(departmentId: string) {
  const id = String(departmentId).trim()
  return `subject_department_id.eq.${id},and(subject_department_id.is.null,department_id.eq.${id})`
}

describe("db integration - marketing agent_contact KPIs", () => {
  it("queries real database for a given date (skips if env missing)", async () => {
    // Loads local secrets if present; safe to call even if file doesn't exist.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config({ path: ".env.local" })

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL")
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("Skipping DB integration test: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
      return
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Pick a date you expect to exist in your DB. Override via env to avoid editing code.
    const targetDate = env("TEST_MARKETING_DATE") || "2026-05-07"

    let marketingDept: any = null
    let deptError: any = null
    try {
      const res = await supabase.from("departments").select("id, name, slug").eq("slug", "marketing").maybeSingle()
      marketingDept = res.data
      deptError = res.error
    } catch (err: any) {
      // In restricted sandboxes, network access may be blocked and `fetch` fails with EPERM.
      console.warn(`Skipping DB integration test: network not available (${err?.message || "unknown error"})`)
      return
    }

    if (deptError && /fetch failed/i.test(String(deptError.message || deptError.details || ""))) {
      console.warn("Skipping DB integration test: network not available (fetch failed)")
      return
    }

    expect(deptError).toBeNull()
    expect(marketingDept?.id).toBeTruthy()

    const deptId = String(marketingDept!.id)

    // Calls done: all agent_contact rows in that day for Marketing (by dept coalesce filter).
    let callsDone: number | null = null
    let callsErr: any = null
    try {
      const res = await supabase
        .from("captain_log_entries")
        .select("id", { count: "exact", head: true })
        .or(buildDepartmentCoalesceOrFilter(deptId))
        .eq("entry_kind", "agent_contact")
        .eq("date", targetDate)
      callsDone = res.count
      callsErr = res.error
    } catch (err: any) {
      console.warn(`Skipping DB integration test: network not available (${err?.message || "unknown error"})`)
      return
    }

    if (callsErr && /fetch failed/i.test(String(callsErr.message || callsErr.details || ""))) {
      console.warn("Skipping DB integration test: network not available (fetch failed)")
      return
    }

    expect(callsErr).toBeNull()
    expect(typeof callsDone).toBe("number")

    // Agents contacted: distinct subject_agent_id values (excluding NULL).
    let agentIdsRows: any[] | null = null
    let agentsErr: any = null
    try {
      const res = await supabase
        .from("captain_log_entries")
        .select("subject_agent_id")
        .or(buildDepartmentCoalesceOrFilter(deptId))
        .eq("entry_kind", "agent_contact")
        .eq("date", targetDate)
        .not("subject_agent_id", "is", null)
      agentIdsRows = res.data
      agentsErr = res.error
    } catch (err: any) {
      console.warn(`Skipping DB integration test: network not available (${err?.message || "unknown error"})`)
      return
    }

    if (agentsErr && /fetch failed/i.test(String(agentsErr.message || agentsErr.details || ""))) {
      console.warn("Skipping DB integration test: network not available (fetch failed)")
      return
    }

    expect(agentsErr).toBeNull()

    const distinct = new Set((agentIdsRows || []).map((r: any) => r.subject_agent_id).filter(Boolean)).size

    // Basic invariants: calls done >= distinct agents contacted.
    expect((callsDone ?? 0) >= distinct).toBe(true)
  })
})
