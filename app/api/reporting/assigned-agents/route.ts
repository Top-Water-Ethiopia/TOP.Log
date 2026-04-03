import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { getMarketingDepartmentById, getSalesPromoterAssignment } from "@/lib/server/marketing-agents"

export const dynamic = "force-dynamic"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId")?.trim() || ""
    const date = searchParams.get("date")?.trim() || ""

    if (!departmentId || !date) {
      return NextResponse.json({ error: "departmentId and date are required" }, { status: 400 })
    }

    if (!isValidDate(date)) {
      return NextResponse.json({ error: "A valid YYYY-MM-DD date is required" }, { status: 400 })
    }

    const marketingDepartment = await getMarketingDepartmentById(adminSupabase, departmentId)
    if (!marketingDepartment) {
      return NextResponse.json({ error: "Assigned agents are only available in the Marketing department" }, { status: 400 })
    }

    const assignment = await getSalesPromoterAssignment(adminSupabase, user.id, departmentId)
    if (!assignment) {
      return NextResponse.json({ error: "Only Marketing Sales Promoters can access assigned agents" }, { status: 403 })
    }

    const { data: agents, error: agentsError } = await adminSupabase
      .from("marketing_agents")
      .select("id, name, location, phone_e164, phone_raw, is_active")
      .eq("department_id", departmentId)
      .eq("sales_promoter_user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (agentsError) {
      return NextResponse.json({ error: "Failed to load assigned agents", message: agentsError.message }, { status: 500 })
    }

    const agentIds = (agents || []).map((agent) => agent.id)
    const { data: existingEntries, error: entriesError } =
      agentIds.length > 0
        ? await adminSupabase
            .from("captain_log_entries")
            .select("subject_agent_id")
            .eq("entry_kind", "agent_call")
            .eq("submitted_by_user_id", user.id)
            .eq("subject_department_id", departmentId)
            .eq("date", date)
            .in("subject_agent_id", agentIds)
        : { data: [], error: null }

    if (entriesError) {
      return NextResponse.json(
        { error: "Failed to check existing agent call reports", message: entriesError.message },
        { status: 500 }
      )
    }

    const reportedAgentIds = new Set(
      (existingEntries || [])
        .map((entry) => (typeof entry.subject_agent_id === "string" ? entry.subject_agent_id : null))
        .filter((value): value is string => Boolean(value))
    )

    return NextResponse.json({
      data: (agents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        location: agent.location ?? null,
        phone: agent.phone_e164 ?? agent.phone_raw ?? null,
        alreadyReported: reportedAgentIds.has(agent.id),
      })),
      assignment,
      department: marketingDepartment,
    })
  } catch (error) {
    console.error("Unexpected error loading assigned agents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
