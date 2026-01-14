import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const departmentId: string | null = typeof body?.department_id === "string" ? body.department_id : null
    const requestedRole: string | null = typeof body?.requested_role === "string" ? body.requested_role : null
    const message: string | null = typeof body?.message === "string" ? body.message : null

    const nowIso = new Date().toISOString()

    const { data, error } = await supabase
      .from("access_requests")
      .insert({
        user_id: user.id,
        requester_email: user.email ?? null,
        department_id: departmentId,
        requested_role: requestedRole,
        message,
        status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to submit access request",
          message: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
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
