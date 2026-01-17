"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminDepartmentProfessionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  useEffect(() => {
    if (isLoading) return

    if (rbacLoading || !rbacChecked) return

    if (!user || !canAccessAdmin) {
      router.push("/")
      return
    }

    router.replace(`/admin/departments/${departmentId}?tab=roles`)
  }, [user, canAccessAdmin, isLoading, router, departmentId, rbacChecked, rbacLoading])

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
        <Skeleton className="mt-2 h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  )
}
