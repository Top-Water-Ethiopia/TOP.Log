"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { useRBAC } from "@/hooks/use-rbac"
import { useTheme } from "next-themes"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DatabaseIcon,
  UserIcon,
  LogOutIcon,
  ChevronDownIcon,
  LockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  Moon,
  Sun,
  LayoutDashboard,
} from "lucide-react"

// Role IDs from schema
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

export function SupabaseNav() {
  const { user, profile, logout, isLoading } = useSupabaseAuth()
  const { canAccessAdmin } = useRBAC()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const darkModeEnabled = isFeatureEnabledClient("DARK_MODE")
  const profileEnabled = isFeatureEnabledClient("PROFILE")

  const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

  const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const actionMenuItems: ActionMenuItem[] = (() => {
    const items: ActionMenuItem[] = []

    const showAccountHeader = profileEnabled || darkModeEnabled

    if (showAccountHeader) {
      items.push({ type: "label", label: "My Account" })
      items.push({ type: "separator" })
    }

    if (profileEnabled) {
      items.push({
        type: "item",
        asChild: true,
        node: (
          <Link href="/profile" className="flex items-center">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        ),
      })
    }

    if (isAdmin) {
      items.push({
        type: "item",
        asChild: true,
        node: (
          <Link href="/admin" className="flex items-center">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Admin Dashboard</span>
          </Link>
        ),
      })
    }

    if (canAccessAdmin && !isAdmin) {
      items.push({
        type: "item",
        asChild: true,
        node: (
          <Link href="/admin" className="flex items-center">
            <LockIcon className="mr-2 h-4 w-4" />
            <span>Admin Dashboard</span>
          </Link>
        ),
      })
    }

    if (darkModeEnabled) {
      if (items.length > 0 && items[items.length - 1]?.type !== "separator") {
        items.push({ type: "separator" })
      }

      items.push({
        type: "item",
        label: mounted ? (theme === "dark" ? "Light Mode" : "Dark Mode") : "Theme",
        icon: mounted ? (
          theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )
        ) : (
          <Moon className="mr-2 h-4 w-4" />
        ),
        onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
      })
    }

    if (items.length > 0 && items[items.length - 1]?.type !== "separator") {
      items.push({ type: "separator" })
    }

    items.push({
      type: "item",
      label: "Log out",
      icon: <LogOutIcon className="mr-2 h-4 w-4" />,
      onSelect: handleLogout,
    })

    return items
  })()

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <DatabaseIcon className="mr-2 h-4 w-4" />
        <span className="hidden md:inline">Loading...</span>
      </Button>
    )
  }

  return (
    <>
      {user ? (
        <ActionMenu
          align="end"
          contentClassName="w-56"
          trigger={
            <Button variant="outline" size="sm">
              <UserIcon className="mr-2 h-4 w-4" />
              <span className="mr-1 hidden md:inline">{profile?.name || user.email}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          }
          items={actionMenuItems}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <InfoIcon className="mr-2 h-4 w-4" />
                <span>Supabase Status</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Supabase Integration</DialogTitle>
                <DialogDescription>Configure Supabase to enable cloud storage and authentication</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-4">
                  {isSupabaseConfigured ? (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <AlertCircleIcon className="h-6 w-6 text-amber-600" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="font-medium">Supabase Configuration</h4>
                    {isSupabaseConfigured ? (
                      <p className="text-muted-foreground text-sm">
                        Supabase is configured correctly. You can now log in to use cloud features.
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Supabase is not configured. Please set up your environment variables.
                      </p>
                    )}
                    <div className="pt-2">
                      <Link href="/SUPABASE_SETUP.md" className="text-primary text-sm hover:underline">
                        View setup instructions
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Close
                    </Button>
                    {isSupabaseConfigured && (
                      <Button asChild>
                        <Link href="/login">Login</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button size="sm" asChild>
            <Link href="/login">
              <LockIcon className="mr-2 h-4 w-4" />
              <span>Login</span>
            </Link>
          </Button>
        </div>
      )}
    </>
  )
}
