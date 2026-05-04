"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function AdminDepartmentAccessDepartmentPage() {
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId

  useEffect(() => {
    if (!departmentId) return
    router.replace("/admin/role-and-access")
  }, [departmentId, router])

  return null
}
