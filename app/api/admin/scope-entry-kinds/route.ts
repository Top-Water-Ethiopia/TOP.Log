import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermission, verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type ScopeType = "dept_wide_personal" | "profession_personal" | "dept_report"

// Default colors and icons for system entry kinds
const SYSTEM_ENTRY_KIND_DEFAULTS: Record<string, { label: string; color: string; icon: string; description: string }> =
  {
    standard: {
      label: "Standard",
      color: "#6B7280", // gray
      icon: "FileText",
      description: "Default report type for general entries",
    },
    agent_call: {
      label: "Agent Call",
      color: "#3B82F6", // blue
      icon: "Phone",
      description: "Used for agent-linked reports with assigned agent dropdown",
    },
    daily_summary: {
      label: "Daily Summary",
      color: "#10B981", // green
      icon: "Calendar",
      description: "Used for once-per-day summary reports",
    },
  }

// Helper to check if user has department access (for read operations)
async function userCanAccessDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId: string
) {
  const { data: memberships, error: membershipError } = await supabase
    .from("user_department_memberships")
    .select("department_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .limit(1)

  if (membershipError) {
    console.error("Error checking department membership:", membershipError)
  }

  return (memberships || []).length > 0
}

// GET - List scope entry kinds with self-healing
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const adminCheck = await verifyPermission("admin.system")

    // Get query parameters
    const url = new URL(request.url)
    const departmentId = url.searchParams.get("departmentId")
    const departmentProfessionId = url.searchParams.get("departmentProfessionId") // legacy
    const scopeTypeParam = url.searchParams.get("scopeType")
    const professionRoleIdParam = url.searchParams.get("professionRoleId")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const permCheck = adminCheck.ok
      ? ({ ok: true } as const)
      : await verifyPermissionForDepartmentFromRequest(request, "departments.manage", departmentId)
    const readCheck = permCheck.ok
      ? null
      : await verifyPermissionForDepartmentFromRequest(request, "departments.read", departmentId)

    let hasPermission = permCheck.ok || readCheck?.ok

    if (!hasPermission) {
      hasPermission = await userCanAccessDepartment(supabase, user.id, departmentId)
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const userId = user.id

    // Query for existing configs
    let query = (adminSupabase as any).from("scope_entry_kinds").select("*").eq("department_id", departmentId)

    const scopeType = (scopeTypeParam as ScopeType | null) ?? null

    if (scopeType) {
      query = query.eq("scope_type", scopeType)
      if (scopeType === "profession_personal") {
        if (!professionRoleIdParam) {
          return NextResponse.json({ error: "professionRoleId is required for profession_personal" }, { status: 400 })
        }
        query = query.eq("profession_role_id", professionRoleIdParam)
      } else {
        query = query.is("department_profession_id", null)
      }
    } else if (departmentProfessionId) {
      // departmentProfessionId is legacy TEXT (profession key), not UUID
      query = query.eq("department_profession_id", departmentProfessionId)
    } else {
      query = query.is("department_profession_id", null)
    }

    const { data: existingConfigs, error: queryError } = (await query) as any

    if (queryError) {
      console.error("Error fetching scope entry kinds:", queryError)
      return NextResponse.json(
        { error: "Failed to fetch scope entry kinds", message: queryError.message },
        { status: 500 }
      )
    }

    // Self-healing: if no configs found, create minimal default
    let selfHealed = false
    let configs = existingConfigs

    const canSelfHeal =
      scopeType == null
        ? departmentProfessionId == null // legacy: only dept-wide
        : scopeType === "dept_wide_personal" // new: only personal dept-wide

    if (canSelfHeal && (!configs || configs.length === 0)) {
      try {
        const defaults = SYSTEM_ENTRY_KIND_DEFAULTS.standard
        const { data: newConfig, error: insertError } = await (adminSupabase as any)
          .from("scope_entry_kinds")
          .insert({
            department_id: departmentId,
            department_profession_id: departmentProfessionId || null,
            scope_type: scopeType ?? "dept_wide_personal",
            entry_kind: "standard",
            label: defaults.label,
            description: defaults.description,
            sort_order: 0,
            is_default: true,
            is_active: true,
            allow_multiple_per_day: false,
            color: defaults.color,
            icon: defaults.icon,
            created_by: userId,
            updated_by: userId,
          })
          .select("*")
          .single()

        if (insertError) {
          // Handle unique conflict (race condition)
          if (insertError.code === "23505") {
            // Re-query to get the existing config
            const { data: retryConfigs, error: retryError } = await (adminSupabase as any)
              .from("scope_entry_kinds")
              .select("*")
              .eq("department_id", departmentId)
              .eq("department_profession_id", departmentProfessionId || null)
              .eq("scope_type", scopeType ?? "dept_wide_personal")

            if (retryError) {
              console.error("Error re-querying after conflict:", retryError)
              return NextResponse.json(
                { error: "Failed to fetch scope entry kinds after conflict", message: retryError.message },
                { status: 500 }
              )
            }
            configs = retryConfigs
          } else {
            console.error("Error self-healing scope entry kinds:", insertError)
            return NextResponse.json(
              { error: "Failed to initialize scope entry kinds", message: insertError.message },
              { status: 500 }
            )
          }
        } else {
          configs = [newConfig]
          selfHealed = true

          // Log self-healing event
          console.log(
            `[Self-heal] Created default config for scope: ${departmentId}/${departmentProfessionId || "dept"} by user ${userId}`
          )
        }
      } catch (healError) {
        console.error("Error during self-healing:", healError)
        return NextResponse.json({ error: "Failed to initialize scope entry kinds" }, { status: 500 })
      }
    }

    // Sort by sort_order, then label
    ;(configs as any)?.sort((a: any, b: any) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.label.localeCompare(b.label)
    })

    const scope = scopeType === "profession_personal" || departmentProfessionId ? "profession" : "department"

    return NextResponse.json({
      data: configs || [],
      scope,
      self_healed: selfHealed,
    })
  } catch (error) {
    console.error("Scope entry kinds GET error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch scope entry kinds",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// PUT - Bulk update scope entry kinds
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { departmentId, departmentProfessionId, configs, scopeType: scopeTypeBody, professionRoleId } = body

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const adminCheck = await verifyPermission("admin.system")
    if (!adminCheck.ok) {
      const auth = await verifyPermissionForDepartmentFromRequest(request, "departments.manage", departmentId)
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }
    }

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json({ error: "configs array is required" }, { status: 400 })
    }

    // Get current user for audit
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id

    const scopeType = (scopeTypeBody as ScopeType | undefined) ?? null

    // Validation rules:
    // - dept_wide_personal + dept_report: require at least one active + exactly one default among active
    // - profession_personal: allow empty (all inactive); if any active, require exactly one default among active
    // - legacy dept-wide: require at least one active + exactly one default among active
    // - legacy profession: allow empty; if any active, require exactly one default among active
    const activeConfigs = configs.filter((c: { is_active: boolean }) => c.is_active)
    const defaultConfigs = activeConfigs.filter((c: { is_default: boolean }) => c.is_default)

    const requiresActive = scopeType
      ? scopeType !== "profession_personal"
      : departmentProfessionId == null // legacy dept-wide

    if (requiresActive && activeConfigs.length === 0) {
      return NextResponse.json({ error: "At least one entry kind must be active" }, { status: 400 })
    }

    if (activeConfigs.length > 0 && defaultConfigs.length !== 1) {
      return NextResponse.json(
        { error: "Exactly one entry kind must be marked as default among active ones" },
        { status: 400 }
      )
    }

    // Check for deactivation block: cannot deactivate if active questions exist
    for (const config of configs) {
      if (!config.is_active && config.id) {
        // Check if this is an existing config being deactivated
        const { data: existing } = await (adminSupabase as any)
          .from("scope_entry_kinds")
          .select("is_active")
          .eq("id", config.id)
          .single()

        if (existing?.is_active && !config.is_active) {
          // Being deactivated - check for active questions
          let countQuery = (adminSupabase as any)
            .from("role_questions")
            .select("*", { count: "exact", head: true })
            .eq("department_id", departmentId)
            .eq("entry_kind", config.entry_kind)
            .eq("is_active", true)

          if (scopeType === "dept_report") {
            // Department report questions are department-scoped (no profession) and tagged as dept_report
            countQuery = countQuery.is("department_profession_id", null).eq("question_scope_type", "dept_report")
          } else if (scopeType === "profession_personal") {
            countQuery = countQuery.eq("department_profession_id", professionRoleId)
          } else {
            // Legacy + dept-wide personal
            countQuery = countQuery.eq("department_profession_id", departmentProfessionId || null)
          }

          const { count, error: countError } = await countQuery

          if (countError) {
            console.error("Error counting questions:", countError)
            return NextResponse.json(
              { error: "Failed to validate deactivation", message: countError.message },
              { status: 500 }
            )
          }

          if (count && count > 0) {
            return NextResponse.json(
              {
                error: `Cannot deactivate entry kind "${config.label}" with ${count} active questions. Reassign or archive questions first.`,
                blocking_count: count,
                entry_kind: config.entry_kind,
              },
              { status: 400 }
            )
          }
        }
      }
    }

    if (scopeType) {
      if (scopeType === "profession_personal" && !professionRoleId) {
        return NextResponse.json({ error: "professionRoleId is required for profession_personal" }, { status: 400 })
      }
      if (scopeType === "dept_report" && professionRoleId) {
        return NextResponse.json({ error: "professionRoleId is not allowed for dept_report" }, { status: 400 })
      }

      const normalizedConfigs = configs.map((config: any) => ({
        ...config,
        color: config.color || SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.color || "#6B7280",
        icon: config.icon || SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.icon || "FileText",
      }))

      const { data, error } = await (adminSupabase as any).rpc("update_scope_entry_kinds_bulk", {
        p_department_id: departmentId,
        p_scope_type: scopeType,
        p_profession_role_id: professionRoleId || null,
        p_configs: normalizedConfigs,
        p_updated_by: userId || null,
      })

      if (error) {
        console.error("Error bulk updating scope entry kinds:", error)
        return NextResponse.json({ error: "Failed to update scope entry kinds", message: error.message }, { status: 500 })
      }

      const results = Array.isArray(data) ? data : []
      return NextResponse.json({ data: results })
    }

    // Perform upserts for each config
    const results = []
    for (const config of configs) {
      const upsertData = {
        department_id: departmentId,
        department_profession_id: departmentProfessionId || null,
        scope_type: departmentProfessionId ? "profession_personal" : "dept_wide_personal",
        entry_kind: config.entry_kind,
        label: config.label,
        description: config.description || null,
        sort_order: config.sort_order ?? 0,
        is_default: config.is_default ?? false,
        is_active: config.is_active ?? true,
        supports_assigned_agent: config.supports_assigned_agent ?? false,
        allow_multiple_per_day: config.allow_multiple_per_day ?? false,
        color: config.color || SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.color || "#6B7280",
        icon: config.icon || SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.icon || "FileText",
        updated_by: userId,
      }

      if (config.id) {
        const { data, error } = await (adminSupabase as any)
          .from("scope_entry_kinds")
          .update(upsertData)
          .eq("id", config.id)
          .select("*")
          .single()

        if (error) {
          console.error("Error updating config:", error)
          return NextResponse.json(
            { error: `Failed to update config for ${config.entry_kind}`, message: error.message },
            { status: 500 }
          )
        }
        results.push(data)
      } else {
        // Insert new
        const { data, error } = await (adminSupabase as any)
          .from("scope_entry_kinds")
          .insert({ ...upsertData, created_by: userId })
          .select("*")
          .single()

        if (error) {
          console.error("Error inserting config:", error)
          return NextResponse.json(
            { error: `Failed to create config for ${config.entry_kind}`, message: error.message },
            { status: 500 }
          )
        }
        results.push(data)
      }
    }

    // Sort results
    ;(results as any).sort((a: any, b: any) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.label.localeCompare(b.label)
    })

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error("Scope entry kinds PUT error:", error)
    return NextResponse.json(
      {
        error: "Failed to update scope entry kinds",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// POST - Create a new custom entry kind
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { departmentId, departmentProfessionId, config, scopeType: scopeTypeBody, professionRoleId } = body

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const adminCheck = await verifyPermission("admin.system")
    if (!adminCheck.ok) {
      const auth = await verifyPermissionForDepartmentFromRequest(request, "departments.manage", departmentId)
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }
    }

    if (!config || !config.entry_kind) {
      return NextResponse.json({ error: "config with entry_kind is required" }, { status: 400 })
    }

    const scopeType = (scopeTypeBody as ScopeType | undefined) ?? null
    if (scopeType) {
      if (scopeType === "profession_personal" && !professionRoleId) {
        return NextResponse.json({ error: "professionRoleId is required for profession_personal" }, { status: 400 })
      }
      if (scopeType === "dept_report" && professionRoleId) {
        return NextResponse.json({ error: "professionRoleId is not allowed for dept_report" }, { status: 400 })
      }
    }

    // Normalize key to lowercase
    const normalizedKey = config.entry_kind.toLowerCase().trim()

    // Validate key format: lowercase alphanumeric + underscore, 1-50 chars
    const KEY_REGEX = /^[a-z0-9_]+$/
    if (!KEY_REGEX.test(normalizedKey) || normalizedKey.length > 50) {
      return NextResponse.json(
        {
          error: "Invalid entry kind key",
          message: "Key must be lowercase alphanumeric with underscores only, max 50 characters",
        },
        { status: 400 }
      )
    }

    // Check for uniqueness within scope
    let checkQuery = (adminSupabase as any)
      .from("scope_entry_kinds")
      .select("id")
      .eq("department_id", departmentId)
      .eq("entry_kind", normalizedKey)

    if (scopeType) {
      checkQuery = checkQuery.eq("scope_type", scopeType)
      if (scopeType === "profession_personal") {
        checkQuery = checkQuery.eq("profession_role_id", professionRoleId)
      } else {
        checkQuery = checkQuery.is("department_profession_id", null)
      }
    } else {
      checkQuery = checkQuery.eq("department_profession_id", departmentProfessionId || null)
    }

    const { data: existing, error: checkError } = await checkQuery.maybeSingle()

    if (checkError) {
      console.error("Error checking for existing entry kind:", checkError)
      return NextResponse.json(
        { error: "Failed to validate entry kind uniqueness", message: checkError.message },
        { status: 500 }
      )
    }

    if (existing) {
      return NextResponse.json({ error: `Entry kind "${normalizedKey}" already exists in this scope` }, { status: 400 })
    }

    // Get current user for audit
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id

    // Insert new entry kind
    const { data, error } = await (adminSupabase as any)
      .from("scope_entry_kinds")
      .insert({
        department_id: departmentId,
        department_profession_id: scopeType ? null : departmentProfessionId || null,
        scope_type: scopeType ?? (departmentProfessionId ? "profession_personal" : "dept_wide_personal"),
        profession_role_id: scopeType === "profession_personal" ? professionRoleId : null,
        entry_kind: normalizedKey,
        label: config.label || normalizedKey,
        description: config.description || null,
        sort_order: config.sort_order ?? 0,
        is_default: config.is_default ?? false,
        is_active: config.is_active ?? true,
        supports_assigned_agent: config.supports_assigned_agent ?? false,
        allow_multiple_per_day: config.allow_multiple_per_day ?? false,
        color: config.color || "#6B7280",
        icon: config.icon || "FileText",
        created_by: userId,
        updated_by: userId,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating entry kind:", error)
      return NextResponse.json({ error: "Failed to create entry kind", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Scope entry kinds POST error:", error)
    return NextResponse.json(
      {
        error: "Failed to create entry kind",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
