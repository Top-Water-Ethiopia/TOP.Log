import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

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

  return { isAdmin: true as const, userId: user.id }
}

export async function GET(request: Request) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get("query") || "").trim()

    if (!query) {
      return NextResponse.json({ data: [] })
    }

    const qLower = query.toLowerCase()

    // Pull matching profiles by name (fast-ish)
    const { data: profileMatches, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name")
      .ilike("name", `%${query}%`)
      .limit(20)

    if (profileError) {
      return NextResponse.json({ error: "Failed to search users", message: profileError.message }, { status: 500 })
    }

    const profileByUserId = new Map((profileMatches || []).map((p) => [p.user_id, p]))

    // Pull auth users and filter by email
    const { data: listData, error: listError } = await adminSupabase.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: "Failed to search users", message: listError.message }, { status: 500 })
    }

    const emailMatches = (listData.users || [])
      .filter((u) => (u.email || "").toLowerCase().includes(qLower))
      .slice(0, 20)

    const userIds = new Set<string>()
    ;(profileMatches || []).forEach((p) => userIds.add(p.user_id))
    emailMatches.forEach((u) => userIds.add(u.id))

    const authByUserId = new Map((listData.users || []).map((u) => [u.id, u]))

    const data = Array.from(userIds)
      .map((id) => {
        const auth = authByUserId.get(id)
        const profile = profileByUserId.get(id)
        return {
          user_id: id,
          email: auth?.email || null,
          name: profile?.name || null,
        }
      })
      .sort((a, b) => {
        const an = a.name || a.email || ""
        const bn = b.name || b.email || ""
        return an.localeCompare(bn)
      })
      .slice(0, 20)

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to search users",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
