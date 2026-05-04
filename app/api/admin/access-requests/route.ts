import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let query = adminSupabase.from("access_requests").select("*").order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch access requests", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const id: string | undefined = typeof body?.id === "string" ? body.id : undefined
    const status: string | undefined = typeof body?.status === "string" ? body.status : undefined

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    if (!status || !["pending", "approved", "rejected", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from("access_requests")
      .update({
        status,
        resolved_by: status === "pending" ? null : auth.userId,
        resolved_at: status === "pending" ? null : nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update access request", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
