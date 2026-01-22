"use client"

import { Suspense, useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DepartmentProfessionsManager } from "@/components/department-professions-manager"
import AdminDepartmentMembersPage from "./members/page"
import { AccessControlTab } from "./access-control-tab"

export default function AdminDepartmentPage() {
  return (
    <Suspense fallback={null}>
      <AdminDepartmentPageInner />
    </Suspense>
  )
}

function AdminDepartmentPageInner() {
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId
  const router = useRouter()
  const searchParams = useSearchParams()

  const tab = useMemo(() => {
    const t = searchParams.get("tab") ?? searchParams.get("tabs")
    if (t === "members" || t === "roles" || t === "access-control") return t
    return "members"
  }, [searchParams])

  useEffect(() => {
    if (!departmentId) return
    const t = searchParams.get("tab") ?? searchParams.get("tabs")
    if (!t || (t !== "members" && t !== "roles" && t !== "access-control")) {
      router.replace(`/admin/departments/${departmentId}?tab=members`)
    }
  }, [departmentId, router, searchParams])

  if (tab === "members") {
    return <AdminDepartmentMembersPage />
  }

  if (tab === "roles") {
    const rolesTab = searchParams.get("rolesTab")
    const defaultTab = rolesTab === "assignments" || rolesTab === "members" ? "assignments" : "roles"
    return <DepartmentProfessionsManager departmentId={departmentId} embedded defaultTab={defaultTab} />
  }

  if (tab === "access-control") {
    return <AccessControlTab departmentId={departmentId} />
  }

  return <AdminDepartmentMembersPage />
}
