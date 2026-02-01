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
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"

type Department = {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

type Membership = {
  department_id: string
  role: string
  department: Department
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

  useEffect(() => {
    if (!departmentsEnabled) return
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [departmentsEnabled, user, isLoading, router])

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
        const active = rows.filter((m) => m.department?.is_active)
        if (active.length === 1) {
          router.replace(`/departments/${active[0].department.id}`)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId, departmentsEnabled, router, isLoading, rbacLoading])

  const activeMemberships = useMemo(() => {
    return memberships.filter((m) => m.department?.is_active)
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

  if (isLoading || rbacLoading || !user) {
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
      ) : activeMemberships.length === 0 ? (
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
          {activeMemberships.map((m) => (
            <Link key={m.department.id} href={`/departments/${m.department.id}`} className="block">
              <Card className="border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="truncate">{m.department.name}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {m.role}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{m.department.description || ""}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
