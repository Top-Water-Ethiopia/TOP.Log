"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { RoleQuestionsManager } from "@/components/role-questions-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

export default function AdminRoleQuestionsPage() {
  const { user, profile, isLoading } = useSupabaseAuth()
  const router = useRouter()
  const [headerSearchQuery, setHeaderSearchQuery] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  if (isLoading || !user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => router.push("/")}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
            >
              Go to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Role Question Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage and refine the survey questions assigned to each crew role. Changes apply to future logs immediately.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowCreateRoleDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
            <Link href="/admin/role-questions/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Multiple Questions
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
              <Icons.search className="h-4 w-4" />
            </div>
            <Input
              placeholder="Search roles or questions..."
              className="pl-9"
              value={headerSearchQuery}
              onChange={(e) => setHeaderSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground">Filters results below.</div>
        </div>
      </div>
      <RoleQuestionsManager externalSearchQuery={headerSearchQuery} refreshKey={refreshKey} />

      <Dialog open={showCreateRoleDialog} onOpenChange={setShowCreateRoleDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>
              Create a new role and immediately start adding questions to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="page_role_name">Role Name</Label>
              <Input
                id="page_role_name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g., Captain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page_role_description">Description</Label>
              <Textarea
                id="page_role_description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateRoleDialog(false)}
              disabled={isCreatingRole}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const name = roleName.trim()
                const description = roleDescription.trim()
                if (!name) {
                  toast({
                    title: "Role name is required",
                    description: "Please enter a role name.",
                    variant: "destructive",
                  })
                  return
                }

                setIsCreatingRole(true)
                try {
                  const db = supabase as any
                  const { error } = await db
                    .from("roles")
                    .insert({
                      name,
                      description: description || null,
                      department_id: null,
                    })

                  if (error) throw error

                  toast({
                    title: "Role created",
                    description: "The new role is now available in the list.",
                  })

                  setShowCreateRoleDialog(false)
                  setRoleName("")
                  setRoleDescription("")
                  setRefreshKey((k) => k + 1)
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error?.message || "Failed to create role",
                    variant: "destructive",
                  })
                } finally {
                  setIsCreatingRole(false)
                }
              }}
              disabled={isCreatingRole}
            >
              {isCreatingRole ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



