import { NextResponse } from "next/server"
import { verifyPermission } from "@/lib/rbac/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { normalizeEthiopianPhone } from "@/lib/auth/identifier"
import { getMarketingDepartment, getSalesPromoterAssignment } from "@/lib/server/marketing-agents"
import type { Database } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

type MarketingAgentUpdate = Database["public"]["Tables"]["marketing_agents"]["Update"]

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

async function loadExistingAgent(agentId: string) {
  const { data, error } = await adminSupabase.from("marketing_agents").select("*").eq("id", agentId).maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function PATCH(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const marketingDepartment = await getMarketingDepartment(adminSupabase)
    if (!marketingDepartment) {
      return NextResponse.json({ error: "Marketing department not found" }, { status: 404 })
    }

    const { agentId } = await params
    const existingAgent = await loadExistingAgent(agentId)

    if (!existingAgent || existingAgent.department_id !== marketingDepartment.id) {
      return NextResponse.json({ error: "Marketing agent not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    const name = "name" in body ? getOptionalString(body.name) : undefined
    const location = "location" in body ? getOptionalString(body.location) : undefined
    const phone = "phone" in body ? getOptionalString(body.phone) : undefined
    const salesPromoterUserId =
      "sales_promoter_user_id" in body ? getOptionalString(body.sales_promoter_user_id) : undefined
    const isActive = typeof body.is_active === "boolean" ? body.is_active : undefined

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 })
    }

    if (salesPromoterUserId !== undefined) {
      if (!salesPromoterUserId) {
        return NextResponse.json({ error: "sales_promoter_user_id is required" }, { status: 400 })
      }

      const assignment = await getSalesPromoterAssignment(adminSupabase, salesPromoterUserId, marketingDepartment.id)
      if (!assignment) {
        return NextResponse.json(
          { error: "Selected user must be an active Marketing Sales Promoter" },
          { status: 400 }
        )
      }
    }

    const normalizedPhone = phone ? normalizeEthiopianPhone(phone) : phone === null ? null : undefined
    if (phone && !normalizedPhone) {
      return NextResponse.json({ error: "Enter a valid Ethiopian phone number" }, { status: 400 })
    }

    const updatePayload: MarketingAgentUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updatePayload.name = name
    if (location !== undefined) updatePayload.location = location
    if (salesPromoterUserId !== undefined) updatePayload.sales_promoter_user_id = salesPromoterUserId
    if (isActive !== undefined) updatePayload.is_active = isActive
    if (phone !== undefined) {
      updatePayload.phone_e164 = normalizedPhone ?? null
      updatePayload.phone_raw = phone ?? null
    }

    const { data, error } = await adminSupabase
      .from("marketing_agents")
      .update(updatePayload)
      .eq("id", agentId)
      .select("*")
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "An active agent with this name is already assigned to that Sales Promoter"
              : "Failed to update marketing agent",
          message: error.message,
        },
        { status }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Unexpected error in PATCH /api/admin/marketing-agents/[agentId]:", error)
    return NextResponse.json(
      { error: "Failed to update marketing agent", message: getUnexpectedErrorMessage(error, "Unexpected server error") },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const marketingDepartment = await getMarketingDepartment(adminSupabase)
    if (!marketingDepartment) {
      return NextResponse.json({ error: "Marketing department not found" }, { status: 404 })
    }

    const { agentId } = await params
    const existingAgent = await loadExistingAgent(agentId)

    if (!existingAgent || existingAgent.department_id !== marketingDepartment.id) {
      return NextResponse.json({ error: "Marketing agent not found" }, { status: 404 })
    }

    const { error } = await adminSupabase
      .from("marketing_agents")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)

    if (error) {
      return NextResponse.json({ error: "Failed to deactivate marketing agent", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: agentId })
  } catch (error) {
    console.error("Unexpected error in DELETE /api/admin/marketing-agents/[agentId]:", error)
    return NextResponse.json(
      {
        error: "Failed to deactivate marketing agent",
        message: getUnexpectedErrorMessage(error, "Unexpected server error"),
      },
      { status: 500 }
    )
  }
}
