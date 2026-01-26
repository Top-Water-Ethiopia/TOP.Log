import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_department_roles")
      .select(
        `
        department_id,
        role,
        is_active,
        departments (
          id,
          name,
          description,
          is_active
        )
      `
      )
      .eq("user_id", user.id)
      .eq("is_active", true)

    if (error) {
      return NextResponse.json({ error: "Failed to load departments", message: error.message }, { status: 500 })
    }

    const normalized = (data || [])
      .map((row: unknown) => {
        if (!row || typeof row !== "object") return null
        const r = row as Record<string, unknown>
        const dept = r.departments as Record<string, unknown> | null | undefined
        if (!dept || typeof dept !== "object") return null
        const deptId = dept.id
        if (typeof deptId !== "string" || !deptId) return null
        return {
          department_id: String(r.department_id ?? ""),
          role: String(r.role ?? ""),
          department: {
            id: deptId,
            name: String(dept.name ?? ""),
            description: (typeof dept.description === "string" ? dept.description : null) ?? null,
            is_active: Boolean(dept.is_active),
          },
        }
      })
      .filter(Boolean)

    return NextResponse.json({ data: normalized })
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
