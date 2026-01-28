import { Suspense } from "react"
import { redirect } from "next/navigation"
import HomeUpdated from "./home-updated"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const roleId = profile?.role_id ? String(profile.role_id) : null

    if (roleId) {
      const { data: adminPerm } = await supabase
        .from("permissions")
        .select("id")
        .eq("role_id", roleId)
        .eq("resource", "admin")
        .eq("action", "system")
        .limit(1)

      if (adminPerm && adminPerm.length > 0) {
        const { data: deptRole } = await supabase
          .from("user_department_roles")
          .select("department_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)

        if (!deptRole || deptRole.length === 0) {
          redirect("/admin")
        }
      }
    }
  }

  return (
    <Suspense fallback={null}>
      <HomeUpdated initialRoleQuestions={[]} />
    </Suspense>
  )
}
