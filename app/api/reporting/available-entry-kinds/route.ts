import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveRoleQuestionScope } from "@/lib/reporting-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    const professionId = searchParams.get("professionId") || searchParams.get("role")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const configQuery = (supabase as any)
      .from("scope_entry_kinds")
      .select("*")
      .eq("department_id", departmentId)
      .eq("is_active", true)

    if (professionId) {
      configQuery.eq("department_profession_id", professionId)
    } else {
      configQuery.is("department_profession_id", null)
    }

    // 1. Fetch active entry kind configurations (labels, colors, etc.) for the current scope.
    const { data: configs, error: configError } = await configQuery

    if (configError) {
      console.error("Error fetching entry kind configs:", configError)
      // Fallback to empty configs if this fails, we can still show basic labels
    }

    // 2. Fetch active questions to determine reachability
    const { data: questions, error: queryError } = await supabase
      .from("role_questions")
      .select("entry_kind, department_id, department_profession_id, department_role, is_active")
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

        if (scope.kind === "department") {
          reachableKinds.add(q.entry_kind)
        } else if (professionId && scope.kind === "profession") {
          if (scope.departmentProfessionId === professionId || scope.departmentProfessionKey === professionId) {
            reachableKinds.add(q.entry_kind)
          }
        }
      })
    }

    // 3. Combine configs with reachability
    const available = (configs || [])
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
