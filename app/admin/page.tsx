"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { Users, Shield, Settings, Activity, Database, Clock, FileText, RefreshCw, Building2 } from "lucide-react"
import { getAdminStats } from "@/lib/admin-stats"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"


const quickActions = [
  {
    name: "Captain Log Entries",
    description: "View all individual captain log reports",
    icon: FileText,
    href: "/admin/reports",
    iconForeground: "text-emerald-700",
    iconBackground: "bg-emerald-50",
  },
  {
    name: "Add New User",
    description: "Create a new user account",
    icon: Users,
    href: "/admin/users/new",
    iconForeground: "text-sky-700",
    iconBackground: "bg-sky-50",
  },
  {
    name: "Departments",
    description: "Manage departments",
    icon: Building2,
    href: "/admin/departments",
    iconForeground: "text-blue-700",
    iconBackground: "bg-blue-50",
  },
  {
    name: "Manage Roles",
    description: "Create roles and assign to departments",
    icon: Shield,
    href: "/admin/roles",
    iconForeground: "text-purple-700",
    iconBackground: "bg-purple-50",
  },
  {
    name: "Role Questions",
    description: "Customize questions for each role",
    icon: FileText,
    href: "/admin/role-questions",
    iconForeground: "text-indigo-700",
    iconBackground: "bg-indigo-50",
  },
  {
    name: "System Settings",
    description: "Configure system preferences",
    icon: Settings,
    href: "/admin/settings",
    iconForeground: "text-green-700",
    iconBackground: "bg-green-50",
  },
  {
    name: "View Audit Logs",
    description: "Review system activity",
    icon: FileText,
    href: "/admin/audit-logs",
    iconForeground: "text-amber-700",
    iconBackground: "bg-amber-50",
  },
]

interface Stats {
  totalUsers: number | null
  activeSessions: number | null
  storageUsed: string
  uptime: string
}

export default function AdminPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || isSuperAdmin

  const fetchStats = async () => {
    try {
      setIsRefreshing(true)
      const statsData = await getAdminStats()
      setStats(statsData)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchStats()
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  if (isLoading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access the admin dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayStats = [
    {
      name: "Total Users",
      value: stats?.totalUsers?.toLocaleString() ?? "Loading...",
      icon: Users,
      change: stats ? "+12%" : "",
      changeType: "positive",
    },
    {
      name: "Active Sessions",
      value: stats?.activeSessions?.toString() ?? "Loading...",
      icon: Activity,
      change: stats ? "+5%" : "",
      changeType: "positive",
    },
    {
      name: "Storage Used",
      value: stats?.storageUsed ?? "Loading...",
      icon: Database,
      change: "3%",
      changeType: "neutral",
    },
    {
      name: "Uptime",
      value: stats?.uptime ?? "Loading...",
      icon: Clock,
      change: "0.1%",
      changeType: "negative",
    },
  ]

  return (
    <div className="py-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your application's performance and quick actions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {displayStats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="shrink-0 rounded-md bg-indigo-500 p-3">
                  <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dt className="text-muted-foreground truncate text-sm font-medium">{stat.name}</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold">{stat.value}</div>
                    <div
                      className={
                        "ml-2 flex items-baseline text-sm font-semibold " +
                        (stat.changeType === "positive"
                          ? "text-green-600"
                          : stat.changeType === "negative"
                            ? "text-red-600"
                            : "text-amber-600")
                      }
                    >
                      {stat.change}
                    </div>
                  </dd>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-medium">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.name} href={action.href}>
              <Card className="hover:bg-accent/50 h-full transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className={`${action.iconBackground} rounded-lg p-3`}>
                      <action.icon className={`h-6 w-6 ${action.iconForeground}`} aria-hidden="true" />
                    </div>
                    <div className="ml-4">
                      <h3 className="font-medium">{action.name}</h3>
                      <p className="text-muted-foreground text-sm">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-foreground mb-4 text-lg font-medium">Recent Activity</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex h-40 items-center justify-center">
              <p className="text-muted-foreground">Recent activity will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
