import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

type MembershipRow = {
  user_id: string | null
  department_id: string | null
  role: string | null
  is_active: boolean | null
}

type UserProfileRow = {
  user_id: string
  name: string | null
}

type DepartmentRow = {
  id: string
  name: string | null
  is_active: boolean | null
}

async function listAllAuthUsers() {
  const perPage = 1000
  const maxPages = 50

  const users: Array<{ id: string; email?: string | null }> = []

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      return { users: null as Array<{ id: string; email?: string | null }> | null, error }
    }

    const batch = (data?.users || []) as Array<{ id: string; email?: string | null }>
    users.push(...batch)

    if (batch.length < perPage) break
  }

  return { users, error: null as null }
}

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const }
}

export async function GET(request: Request) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get("format") || "").toLowerCase()
    const userIdFilter = searchParams.get("user_id")

    const membershipsQuery = adminSupabase
      .from("user_department_roles")
      .select("user_id, department_id, role, is_active")
      .eq("is_active", true)

    const { data: memberships, error } =
      typeof userIdFilter === "string" && userIdFilter.trim()
        ? await membershipsQuery.eq("user_id", userIdFilter.trim())
        : await membershipsQuery

    const membershipRows = (memberships || []) as unknown as MembershipRow[]

    if (error) {
      return NextResponse.json({ error: "Failed to load memberships", message: error.message }, { status: 500 })
    }

    if (format === "enriched") {
      const userIds = Array.from(
        new Set(
          membershipRows
            .map((m) => (typeof m?.user_id === "string" ? (m.user_id as string) : null))
            .filter((id: string | null): id is string => !!id)
        )
      )
      const departmentIds = Array.from(
        new Set(
          membershipRows
            .map((m) => (typeof m?.department_id === "string" ? (m.department_id as string) : null))
            .filter((id: string | null): id is string => !!id)
        )
      )

      const [{ data: profiles, error: profilesError }, { data: departments, error: departmentsError }] =
        await Promise.all([
          adminSupabase.from("user_profiles").select("user_id, name").in("user_id", userIds),
          adminSupabase.from("departments").select("id, name, is_active").in("id", departmentIds),
        ])

      if (profilesError) {
        return NextResponse.json(
          { error: "Failed to load member profiles", message: profilesError.message },
          { status: 500 }
        )
      }
      if (departmentsError) {
        return NextResponse.json(
          { error: "Failed to load departments", message: departmentsError.message },
          { status: 500 }
        )
      }

      const profileMap = new Map(
        ((profiles || []) as unknown as UserProfileRow[]).map((p) => [p.user_id, { name: p.name ?? null }])
      )
      const departmentMap = new Map(
        ((departments || []) as unknown as DepartmentRow[]).map((d) => [
          d.id,
          {
            id: d.id,
            name: d.name ?? null,
            is_active: !!d.is_active,
          },
        ])
      )

      const { users: authUsers, error: listError } = await listAllAuthUsers()
      if (listError || !authUsers) {
        return NextResponse.json(
          { error: "Failed to load member emails", message: listError?.message || "Unknown error" },
          { status: 500 }
        )
      }
      const authMap = new Map(authUsers.map((u) => [u.id, u]))

      const enriched = membershipRows.map((m) => {
        const userId = typeof m?.user_id === "string" ? (m.user_id as string) : null
        const departmentId = typeof m?.department_id === "string" ? (m.department_id as string) : null

        const profile = userId ? profileMap.get(userId) : undefined
        const auth = userId ? authMap.get(userId) : undefined
        const dept = departmentId ? departmentMap.get(departmentId) : undefined

        return {
          user_id: userId,
          department_id: departmentId,
          role: typeof m?.role === "string" ? (m.role as string) : null,
          is_active: !!m?.is_active,
          user: {
            user_id: userId,
            name: profile?.name || null,
            email: auth?.email || null,
          },
          department: dept || { id: departmentId, name: null, is_active: null },
        }
      })

      return NextResponse.json({ data: enriched })
    }

    const byUserId: Record<string, string[]> = {}
    for (const m of membershipRows) {
      const userId = typeof m?.user_id === "string" ? (m.user_id as string) : undefined
      const deptId = typeof m?.department_id === "string" ? (m.department_id as string) : undefined
      if (!userId || !deptId) continue
      if (!byUserId[userId]) byUserId[userId] = []
      if (!byUserId[userId].includes(deptId)) byUserId[userId].push(deptId)
    }

    return NextResponse.json({ data: byUserId })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load memberships",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
