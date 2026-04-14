import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveRoleQuestionScope } from "@/lib/reporting-model"
import { resolveEntryKinds } from "@/lib/entry-kinds/resolve"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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
    const departmentId = searchParams.get("departmentId")
    const requestedRole = searchParams.get("professionId") || searchParams.get("role")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    // Resolve all active roles for the user in this department
    const { data: userMemberships } = await supabase
      .from("user_department_memberships")
      .select("role:roles(id, name)")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("is_active", true)

    const userRoles = new Set<string>()
    if (requestedRole) userRoles.add(requestedRole)
    
    userMemberships?.forEach((m: any) => {
      const role = Array.isArray(m.role) ? m.role[0] : m.role
      if (role?.name) userRoles.add(role.name)
      if (role?.id) userRoles.add(role.id)
    })
    const previewProfessionRoleId = requestedRole && looksLikeUuid(requestedRole) ? requestedRole : null

    let resolvedConfigs: any[] = []
    try {
      const resolved = await resolveEntryKinds({
        system: "personal",
        departmentId,
        userId: user.id,
        professionRoleId: previewProfessionRoleId,
      })
      resolvedConfigs = resolved.data
    } catch (e) {
      // For personal logging, missing config should not hard-fail the endpoint.
      console.error("Error resolving entry kinds:", e)
    }

    // 2. Fetch active questions to determine reachability
    const { data: questions, error: queryError } = await supabase
      .from("role_questions")
      .select("entry_kind, department_id, department_profession_id, department_role, question_scope_type, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)

    if (queryError) {
      console.error("Error fetching available entry kinds:", queryError)
      return NextResponse.json(
        { error: "Failed to fetch available types", details: queryError.message },
        { status: 500 }
      )
    }

    const reachableKinds = new Set<string>()
    if (questions) {
      questions.forEach((q) => {
        const scope = resolveRoleQuestionScope(q)
        if (!scope) return

        if (scope.kind === "dept_wide_personal") {
          reachableKinds.add(q.entry_kind)
        } else if (userRoles.size > 0 && scope.kind === "profession") {
          const matches =
            (scope.departmentProfessionId && userRoles.has(scope.departmentProfessionId)) ||
            (scope.departmentProfessionKey && userRoles.has(scope.departmentProfessionKey))

          if (matches) {
            reachableKinds.add(q.entry_kind)
          }
        }
      })
    }

    // 3. Combine configs with reachability
    const available = (resolvedConfigs || [])
      .filter((config: any) => reachableKinds.has(config.entry_kind))
      .map((config: any) => ({
        entry_kind: config.entry_kind,
        label: config.label,
        color: config.color,
        icon: config.icon,
        description: config.description,
        is_default: config.is_default,
        supports_assigned_agent: config.supports_assigned_agent,
        allow_multiple_per_day: config.allow_multiple_per_day ?? false,
      }))

    // 4. Fallback for "standard" if not in configs but has questions
    if (reachableKinds.has("standard") && !available.some((a: any) => a.entry_kind === "standard")) {
      available.push({
        entry_kind: "standard",
        label: "Standard",
        color: "#6B7280",
        icon: "FileText",
        description: "Default report type",
        is_default: false,
        supports_assigned_agent: false,
        allow_multiple_per_day: false,
      })
    }

    return NextResponse.json({ data: available })
  } catch (error) {
    console.error("Unexpected error in available-entry-kinds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
