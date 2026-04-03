import { NextResponse } from "next/server"
import { verifyPermission } from "@/lib/rbac/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { normalizeEthiopianPhone } from "@/lib/auth/identifier"
import { isSalesPromoterProfessionKey, normalizeSalesPromoterProfessionKey } from "@/lib/marketing-agents"
import { getMarketingDepartment, getSalesPromoterAssignment } from "@/lib/server/marketing-agents"
import type { Database } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

type MarketingAgentInsert = Database["public"]["Tables"]["marketing_agents"]["Insert"]

type SalesPromoterOption = {
  user_id: string
  name: string | null
  email: string | null
  profession_id: string | null
  profession_key: string
  profession_label: string | null
}

function getUnexpectedErrorMessage(error: unknown, fallback: string) {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null
  const message =
    typeof (error as { message?: unknown })?.message === "string" ? (error as { message: string }).message : null

  if (code === "42P01" || /marketing_agents/i.test(message || "")) {
    return "The marketing agent schema is not available yet. Apply the latest Supabase migration and reload."
  }

  return message || fallback
}

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function fetchSalesPromoters(departmentId: string): Promise<SalesPromoterOption[]> {
  const { data: assignments, error: assignmentsError } = await adminSupabase
    .from("user_department_professions")
    .select(
      `
      user_id,
      role,
      department_role_id,
      department_profession:department_professions!fk_user_department_professions_department_profession (
        id,
        key,
        label
      )
    `
    )
    .eq("department_id", departmentId)
    .eq("is_active", true)

  if (assignmentsError) {
    throw assignmentsError
  }

  const filteredAssignments = (assignments || []).filter((assignment) => {
    const professionKey =
      typeof assignment.department_profession?.key === "string"
        ? normalizeSalesPromoterProfessionKey(assignment.department_profession.key)
        : typeof assignment.role === "string"
          ? normalizeSalesPromoterProfessionKey(assignment.role)
          : null

    return isSalesPromoterProfessionKey(professionKey)
  })

  const userIds = filteredAssignments
    .map((assignment) => assignment.user_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0)

  const uniqueUserIds = Array.from(new Set(userIds))

  const [{ data: profiles, error: profilesError }, authUsersResult] = await Promise.all([
    uniqueUserIds.length > 0
      ? adminSupabase.from("user_profiles").select("user_id, name").in("user_id", uniqueUserIds)
      : Promise.resolve({ data: [], error: null }),
    adminSupabase.auth.admin.listUsers(),
  ])

  if (profilesError) {
    throw profilesError
  }

  if (authUsersResult.error) {
    throw authUsersResult.error
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]))
  const authMap = new Map((authUsersResult.data.users || []).map((user) => [user.id, user]))

  return filteredAssignments
    .map((assignment) => {
      const professionKey =
        typeof assignment.department_profession?.key === "string"
          ? normalizeSalesPromoterProfessionKey(assignment.department_profession.key)
          : typeof assignment.role === "string"
            ? normalizeSalesPromoterProfessionKey(assignment.role)
            : null

      if (!professionKey || typeof assignment.user_id !== "string") {
        return null
      }

      const profile = profileMap.get(assignment.user_id)
      const authUser = authMap.get(assignment.user_id)

      return {
        user_id: assignment.user_id,
        name: typeof profile?.name === "string" ? profile.name : null,
        email: typeof authUser?.email === "string" ? authUser.email : null,
        profession_id:
          typeof assignment.department_profession?.id === "string" ? assignment.department_profession.id : null,
        profession_key: professionKey,
        profession_label:
          typeof assignment.department_profession?.label === "string" ? assignment.department_profession.label : null,
      } satisfies SalesPromoterOption
    })
    .filter((value): value is SalesPromoterOption => Boolean(value))
    .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""))
}

async function validateSalesPromoterAssignment(userId: string, departmentId: string) {
  const assignment = await getSalesPromoterAssignment(adminSupabase, userId, departmentId)
  return assignment
}

export async function GET() {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const marketingDepartment = await getMarketingDepartment(adminSupabase)
    if (!marketingDepartment) {
      return NextResponse.json({ error: "Marketing department not found" }, { status: 404 })
    }

    const [salesPromoters, agentsResult] = await Promise.all([
      fetchSalesPromoters(marketingDepartment.id),
      adminSupabase
        .from("marketing_agents")
        .select("*")
        .eq("department_id", marketingDepartment.id)
        .order("updated_at", { ascending: false })
        .order("name", { ascending: true }),
    ])

    if (agentsResult.error) {
      return NextResponse.json(
        { error: "Failed to load marketing agents", message: agentsResult.error.message },
        { status: 500 }
      )
    }

    const salesPromoterMap = new Map(salesPromoters.map((salesPromoter) => [salesPromoter.user_id, salesPromoter]))

    return NextResponse.json({
      data: {
        department: marketingDepartment,
        salesPromoters,
        agents: (agentsResult.data || []).map((agent) => ({
          ...agent,
          sales_promoter: salesPromoterMap.get(agent.sales_promoter_user_id) || null,
        })),
      },
    })
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/marketing-agents:", error)
    return NextResponse.json(
      { error: "Failed to load marketing agents", message: getUnexpectedErrorMessage(error, "Unexpected server error") },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const marketingDepartment = await getMarketingDepartment(adminSupabase)
    if (!marketingDepartment) {
      return NextResponse.json({ error: "Marketing department not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const name = getOptionalString(body.name)
    const location = getOptionalString(body.location)
    const phone = getOptionalString(body.phone)
    const salesPromoterUserId = getOptionalString(body.sales_promoter_user_id)
    const isActive = body.is_active !== false

    if (!name || !salesPromoterUserId) {
      return NextResponse.json({ error: "Agent name and Sales Promoter are required" }, { status: 400 })
    }

    const salesPromoterAssignment = await validateSalesPromoterAssignment(salesPromoterUserId, marketingDepartment.id)
    if (!salesPromoterAssignment) {
      return NextResponse.json(
        { error: "Selected user must be an active Marketing Sales Promoter" },
        { status: 400 }
      )
    }

    const normalizedPhone = phone ? normalizeEthiopianPhone(phone) : null
    if (phone && !normalizedPhone) {
      return NextResponse.json({ error: "Enter a valid Ethiopian phone number" }, { status: 400 })
    }

    const insertPayload: MarketingAgentInsert = {
      department_id: marketingDepartment.id,
      sales_promoter_user_id: salesPromoterUserId,
      name,
      location,
      phone_e164: normalizedPhone,
      phone_raw: phone,
      is_active: isActive,
      metadata: {},
    }

    const { data, error } = await adminSupabase.from("marketing_agents").insert(insertPayload).select("*").single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "An active agent with this name is already assigned to that Sales Promoter"
              : "Failed to create marketing agent",
          message: error.message,
        },
        { status }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/marketing-agents:", error)
    return NextResponse.json(
      { error: "Failed to create marketing agent", message: getUnexpectedErrorMessage(error, "Unexpected server error") },
      { status: 500 }
    )
  }
}
