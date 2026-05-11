import crypto from "crypto"
import { adminSupabase } from "@/lib/supabase/admin"

const VIS_SIG_VERSION = "v1"

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export async function computeVisibilitySignature(params: { userId: string; isAdmin: boolean }) {
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    adminSupabase.from("user_profiles").select("role_id").eq("user_id", params.userId).maybeSingle(),
    adminSupabase
      .from("user_department_memberships")
      .select("department_id, role_id")
      .eq("user_id", params.userId)
      .eq("membership_type", "access_level")
      .eq("is_active", true),
  ])

  const globalRoleId = profile?.role_id ? String(profile.role_id) : ""
  const deptPairs = (memberships || [])
    .map((m) => `${String(m.department_id)}:${String(m.role_id)}`)
    .sort((a, b) => a.localeCompare(b))
    .join(",")

  const input = `${VIS_SIG_VERSION}|globalRole:${globalRoleId}|deptAccess:${deptPairs}|isAdmin:${params.isAdmin ? 1 : 0}`
  return sha256Hex(input)
}

