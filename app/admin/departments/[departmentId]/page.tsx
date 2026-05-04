"use client"

import { Suspense, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import AdminDepartmentMembersPage from "./members/page"
import { DepartmentRolesTab } from "./roles-tab"
import { DepartmentAssignDialog } from "./assign-dialog"

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
  const searchParams = useSearchParams()

  const tab = useMemo(() => {
    const t = searchParams.get("tab") ?? searchParams.get("tabs")
    if (t === "members" || t === "roles") return t
    return "roles"
  }, [searchParams])

  const main = (() => {
    if (tab === "members") {
      return <AdminDepartmentMembersPage />
    }

    if (tab === "roles") {
      return <DepartmentRolesTab departmentId={departmentId} />
    }

    return <DepartmentRolesTab departmentId={departmentId} />
  })()

  return (
    <>
      {main}
      <DepartmentAssignDialog departmentId={departmentId} />
    </>
  )
}
