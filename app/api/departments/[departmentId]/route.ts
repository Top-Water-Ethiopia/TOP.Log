import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from("user_department_roles")
      .select(
        `
        department_id,
        departments (
          id,
          name,
          description,
          is_active
        )
      `
      )
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { error: "Failed to load department", message: membershipError.message },
        { status: 500 }
      )
    }

    const dept = membership?.departments
    if (!dept) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({ data: dept })
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
