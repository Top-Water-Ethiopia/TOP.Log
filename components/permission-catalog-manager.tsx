"use client"

import type { ChangeEvent, KeyboardEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"

type PermissionDefinition = {
  id: string
  resource: string
  action: string
  name: string
  description: string | null
}

function normalizePermissionName(name: string) {
  const trimmed = name.trim()
  const idx = trimmed.indexOf(".")
  if (idx <= 0 || idx === trimmed.length - 1) return null

  const resource = trimmed.slice(0, idx).trim().toLowerCase()
  const action = trimmed
    .slice(idx + 1)
    .trim()
    .toLowerCase()

  if (!resource || !action) return null
  if (/\s/.test(resource) || /\s/.test(action)) return null

  return `${resource}.${action}`
}

export function PermissionCatalogManager() {
  const { toast } = useToast()
  const lastLoadErrorRef = useRef<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR<{ data: PermissionDefinition[] }>(
    "/api/admin/permission-definitions"
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PermissionDefinition | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!error) return
    const message = getErrorMessage(error, "Failed to load permissions")
    if (lastLoadErrorRef.current === message) return
    lastLoadErrorRef.current = message
    toast({ title: "Error", description: message, variant: "destructive" })
  }, [error, toast])

  const permissions = useMemo(() => {
    const rows = data?.data || []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
  }, [data, searchQuery])

  const createPermission = async () => {
    const normalized = normalizePermissionName(newName)
    if (!newName.trim()) return

    if (!normalized) {
      toast({
        title: "Invalid permission",
        description: "Permission must look like 'resource.action' and cannot contain spaces",
        variant: "destructive",
      })
      return
    }

    if (isCreating) return
    setIsCreating(true)

    try {
      await apiFetch("/api/admin/permission-definitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalized,
          description: newDescription.trim() || null,
        }),
      })

      toast({ title: "Created", description: `Added ${normalized}` })
      setNewName("")
      setNewDescription("")
      mutate()
    } catch (e) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to create permission"), variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const deletePermission = async () => {
    if (!deleteTarget) return
    if (isDeleting) return

    setIsDeleting(true)
    try {
      await apiFetch(`/api/admin/permission-definitions?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      })

      toast({
        title: "Deleted",
        description: `Removed ${deleteTarget.name} from catalog and all roles`,
      })

      setDeleteTarget(null)
      mutate()
    } catch (e) {
      toast({ title: "Error", description: getErrorMessage(e, "Failed to delete permission"), variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission catalog</CardTitle>
        <CardDescription>
          Manage the list of available permissions. Deleting removes the permission from all roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <Label>Search</Label>
            <Input
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search permissions..."
            />
          </div>
          <div className="pt-6">
            <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Add permission</Label>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={newName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              placeholder="e.g. reports.export"
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  createPermission()
                }
              }}
            />
            <Textarea
              value={newDescription}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={1}
            />
            <Button type="button" onClick={createPermission} disabled={isCreating || !newName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Permissions ({permissions.length})</Label>
          <div className="rounded-lg border">
            <div className="divide-y">
              {permissions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    {p.description ? (
                      <div className="text-muted-foreground truncate text-sm">{p.description}</div>
                    ) : null}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ))}

              {permissions.length === 0 ? (
                <div className="text-muted-foreground p-4 text-sm">No permissions found.</div>
              ) : null}
            </div>
          </div>
        </div>

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open: boolean) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete permission?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deleteTarget?.name}" from the permission catalog and remove it from all
                roles. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deletePermission} className="bg-destructive" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
