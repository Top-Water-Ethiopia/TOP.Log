import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { parseAgentResponseValue } from "@/lib/marketing-agents"
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
    const entryKind = searchParams.get("entryKind")?.trim() || "standard"
    const questionKeys = searchParams.getAll("questionKey").map((key) => key.trim()).filter(Boolean)

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

    const entryIdsResult =
      questionKeys.length > 0
        ? await adminSupabase
            .from("captain_log_entries")
            .select("id")
            .eq("submitted_by_user_id", user.id)
            .eq("subject_department_id", departmentId)
            .eq("entry_kind", entryKind)
            .eq("date", date)
        : { data: [], error: null }

    if (entryIdsResult.error) {
      return NextResponse.json(
        { error: "Failed to check existing reports", message: entryIdsResult.error.message },
        { status: 500 }
      )
    }

    const entryIds = (entryIdsResult.data || []).map((entry) => entry.id).filter(Boolean)

    const responseRowsResult =
      entryIds.length > 0 && questionKeys.length > 0
        ? await adminSupabase
            .from("custom_responses")
            .select("question_key, value")
            .in("entry_id", entryIds)
            .in("question_key", questionKeys)
        : { data: [], error: null }

    if (responseRowsResult.error) {
      return NextResponse.json(
        { error: "Failed to check assigned-agent usage", message: responseRowsResult.error.message },
        { status: 500 }
      )
    }

    const usageByQuestion: Record<string, Record<string, number>> = {}
    for (const row of responseRowsResult.data || []) {
      const questionKey = typeof row.question_key === "string" ? row.question_key : null
      if (!questionKey) continue

      const selectedAgentIds = Array.isArray(row.value)
        ? row.value
            .map((item) => (typeof item === "string" ? item : parseAgentResponseValue(item)?.value ?? null))
            .filter((value): value is string => Boolean(value))
        : (() => {
            const parsed = parseAgentResponseValue(row.value)
            return parsed?.value ? [parsed.value] : []
          })()

      if (!usageByQuestion[questionKey]) {
        usageByQuestion[questionKey] = {}
      }

      selectedAgentIds.forEach((agentId) => {
        usageByQuestion[questionKey][agentId] = (usageByQuestion[questionKey][agentId] || 0) + 1
      })
    }

    return NextResponse.json({
      data: (agents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        location: agent.location ?? null,
        phone: agent.phone_e164 ?? agent.phone_raw ?? null,
        alreadyReported: false,
      })),
      usageByQuestion,
      entryKind,
      questionKeys,
      assignment,
      department: marketingDepartment,
    })
  } catch (error) {
    console.error("Unexpected error loading assigned agents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
