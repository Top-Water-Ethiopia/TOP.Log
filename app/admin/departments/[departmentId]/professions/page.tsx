"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Skeleton } from "@/components/ui/skeleton"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function AdminDepartmentProfessionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const params = useParams<{ departmentId: string }>()
  const departmentId = params.departmentId

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  useEffect(() => {
    if (isLoading) return

    if (!user || !isAdmin) {
      router.push("/")
      return
    }

    router.replace(`/admin/departments/${departmentId}?tab=roles`)
  }, [user, isAdmin, isLoading, router, departmentId])

  if (isLoading || !user || !profile) {
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
