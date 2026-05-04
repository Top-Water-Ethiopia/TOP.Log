"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminDepartmentAccessIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/role-and-access")
  }, [router])

  return null
}
