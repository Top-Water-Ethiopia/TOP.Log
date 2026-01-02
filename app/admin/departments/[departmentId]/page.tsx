"use client"

import { useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DepartmentProfessionsManager } from "@/components/department-professions-manager"
import AdminDepartmentMembersPage from "./members/page"

export default function AdminDepartmentPage() {
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId
  const router = useRouter()
  const searchParams = useSearchParams()

  const tab = useMemo(() => {
    const t = searchParams.get("tab")
    if (t === "about" || t === "members" || t === "roles") return t
    return "about"
  }, [searchParams])

  useEffect(() => {
    if (!departmentId) return
    const t = searchParams.get("tab")
    if (!t || (t !== "about" && t !== "members" && t !== "roles")) {
      router.replace(`/admin/departments/${departmentId}?tab=about`)
    }
  }, [departmentId, router, searchParams])

  if (tab === "members") {
    return <AdminDepartmentMembersPage />
  }

  if (tab === "roles") {
    return <DepartmentProfessionsManager departmentId={departmentId} embedded defaultTab="roles" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
        <CardDescription>Overview and details for this department.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">Department ID: {departmentId}</div>
      </CardContent>
    </Card>
  )
}
