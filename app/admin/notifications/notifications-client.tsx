"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type AccessRequest = {
  id: string
  user_id: string
  requester_email: string | null
  requested_role: string | null
  department_id: string | null
  message: string | null
  status: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

function badgeVariantForStatus(status: string): "default" | "secondary" | "success" | "destructive" | "outline" {
  if (status === "approved") return "success"
  if (status === "rejected") return "destructive"
  if (status === "resolved") return "secondary"
  if (status === "pending") return "outline"
  return "default"
}

export default function AdminNotificationsClientPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()

  const { hasPermission, rbacChecked, rbacLoading } = useRBAC()
  const canAccessAdmin = hasPermission("admin.system")

  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [activeStatus, setActiveStatus] = useState<string>("pending")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/")
      return
    }

    if (!rbacChecked || rbacLoading) return

    if (!canAccessAdmin) {
      router.push("/")
    }
  }, [canAccessAdmin, isLoading, router, user, rbacChecked, rbacLoading])

  const loadRequests = async (status: string) => {
    try {
      setIsLoadingRequests(true)
      const qs = status ? `?status=${encodeURIComponent(status)}` : ""
      const json = await apiFetch<{ data: AccessRequest[] }>(`/api/admin/access-requests${qs}`)
      setRequests(Array.isArray(json.data) ? json.data : [])
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load access requests"))
      setRequests([])
    } finally {
      setIsLoadingRequests(false)
    }
  }

  useEffect(() => {
    if (!canAccessAdmin) return
    void loadRequests(activeStatus)
  }, [canAccessAdmin, activeStatus])

  const updateStatus = async (id: string, status: string) => {
    if (updatingId) return

    try {
      setUpdatingId(id)
      await apiFetch("/api/admin/access-requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      toast.success("Updated")
      await loadRequests(activeStatus)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update request"))
    } finally {
      setUpdatingId(null)
    }
  }

  if (isLoading || rbacLoading || !user || !profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-5 w-80 bg-gray-200/70 dark:bg-gray-800" />
        </div>
      </div>
    )
  }

  if (rbacChecked && !canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-2">Review access requests from users.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "pending", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
          { key: "resolved", label: "Resolved" },
        ].map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={activeStatus === t.key ? "default" : "outline"}
            onClick={() => setActiveStatus(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access Requests</CardTitle>
          <CardDescription>Most recent requests first.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable isLoading={isLoadingRequests} isEmpty={!isLoadingRequests && requests.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={badgeVariantForStatus(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{r.requester_email || "-"}</TableCell>
                    <TableCell>{r.department_id || "-"}</TableCell>
                    <TableCell className="max-w-[420px] whitespace-normal">{r.message || "-"}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!updatingId}
                          onClick={() => updateStatus(r.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!updatingId}
                          onClick={() => updateStatus(r.id, "rejected")}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!updatingId}
                          onClick={() => updateStatus(r.id, "resolved")}
                        >
                          Resolve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  )
}
