"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Lock, Star } from "lucide-react"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"

type Department = {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

type Membership = {
  department_id: string
  department: Department
  // Effective role (new contract)
  roleType: "profession" | "access-level" | null
  roleKey: string | null
  roleLabel: string | null
  // Membership status
  is_primary: boolean
  membershipStatus: "active" | "inactive"
  // Explicit capabilities (new contract)
  canViewReports: boolean
  canCreateReports: boolean
  canAnswerDepartmentReports: boolean
  // Legacy fields (backwards compatibility)
  role?: string
}

export default function DepartmentsPage() {
  const departmentsEnabled = isFeatureEnabledClient("DEPARTMENTS")
  const { user, isLoading } = useSupabaseAuth()
  const { rbacLoading, hasPermission } = useRBAC()
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const userId = user?.id

  const canAccessAdmin = hasPermission("admin.system")

  // Check for system-wide department access permissions
  const hasSystemWideDeptAccess =
    hasPermission("departments.read") ||
    hasPermission("departments.create") ||
    hasPermission("departments.update") ||
    hasPermission("departments.delete") ||
    hasPermission("departments.members.read") ||
    hasPermission("departments.members.manage") ||
    canAccessAdmin

  useEffect(() => {
    if (!departmentsEnabled) return
    if (!isLoading && !user) {
      router.push("/login")
      return
    }
    // Redirect if user doesn't have system-wide department access
    if (!isLoading && !rbacLoading && user && !hasSystemWideDeptAccess) {
      router.replace("/")
      toast.error("Access denied")
    }
  }, [departmentsEnabled, user, isLoading, rbacLoading, hasSystemWideDeptAccess, router])

  useEffect(() => {
    if (!userId) return
    if (!departmentsEnabled) {
      setMemberships([])
      setLoading(false)
      return
    }
    if (isLoading || rbacLoading) return

    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/departments")
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login")
            return
          }
          if (res.status === 403) {
            router.replace("/")
            toast.error("Access denied")
            return
          }
          throw new Error(json.message || json.error || `HTTP ${res.status}`)
        }
        const rows = (json.data || []) as Membership[]
        setMemberships(rows)
        // Only auto-redirect if there's exactly one ACTIVE membership
        const active = rows.filter((m) => m.membershipStatus === "active")
        if (active.length === 1) {
          router.replace(`/departments/${active[0].department.id}`)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId, departmentsEnabled, router, isLoading, rbacLoading])

  // Sort: primary first, then active, then alphabetically
  const sortedMemberships = useMemo(() => {
    return [...memberships].sort((a, b) => {
      // Primary first
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      // Then active
      if (a.membershipStatus === "active" && b.membershipStatus === "inactive") return -1
      if (a.membershipStatus === "inactive" && b.membershipStatus === "active") return 1
      // Then alphabetically
      return a.department.name.localeCompare(b.department.name)
    })
  }, [memberships])

  if (!departmentsEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>This feature is not available yet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canAccessAdmin ? (
              <Button asChild>
                <Link href="/admin/departments">Go to Admin Departments</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/">Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || rbacLoading || !user || !hasSystemWideDeptAccess) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border border-gray-200 shadow-sm">
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 bg-gray-200/70 dark:bg-gray-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Departments</h2>
        <p className="text-muted-foreground mt-2">Select a department to view reports and members.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border border-gray-200 shadow-sm">
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 bg-gray-200/70 dark:bg-gray-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedMemberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No departments</CardTitle>
            <CardDescription>
              You are not assigned to any departments yet. Please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedMemberships.map((m) => {
            const isInactive = m.membershipStatus === "inactive"
            const cardContent = (
              <Card
                className={`border shadow-sm transition-shadow ${isInactive ? "border-gray-200 bg-gray-50/50" : "border-gray-200 hover:shadow-md"}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className={`truncate ${isInactive ? "text-gray-500" : ""}`}>{m.department.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.is_primary && (
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                          <Star className="mr-1 h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                      <Badge
                        variant={isInactive ? "outline" : "secondary"}
                        className={isInactive ? "border-dashed text-gray-500" : ""}
                      >
                        {m.roleLabel || m.role || "Member"}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription className={`line-clamp-2 ${isInactive ? "text-gray-400" : ""}`}>
                    {m.department.description || ""}
                  </CardDescription>
                  {isInactive && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <Lock className="h-4 w-4" />
                      <span>Locked — contact admin to reactivate</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent />
              </Card>
            )

            return isInactive ? (
              <div key={m.department.id} className="block cursor-not-allowed">
                {cardContent}
              </div>
            ) : (
              <Link key={m.department.id} href={`/departments/${m.department.id}`} className="block">
                {cardContent}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
