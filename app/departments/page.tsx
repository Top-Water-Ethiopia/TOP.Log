"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
  const { user, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/departments")
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
        setMemberships((json.data || []) as Membership[])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  const activeMemberships = useMemo(() => {
    return memberships.filter((m) => m.department?.is_active)
  }, [memberships])

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground mt-2">Select a department to view reports and members.</p>
        </div>
        <Link href="/">
          <Button variant="outline">Back</Button>
        </Link>
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
            <CardDescription>You are not assigned to any departments yet.</CardDescription>
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
