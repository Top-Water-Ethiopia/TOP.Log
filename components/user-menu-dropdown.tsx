"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronDown, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"

export interface UserMenuDropdownProps {
  isAuthenticated: boolean
  displayLabel: string
  avatarLabel: string
  /**
   * When true (default), do not render the menu until after mount.
   * This avoids SSR/client hydration mismatches for auth-derived UI.
   */
  deferUntilMounted?: boolean
}

export function UserMenuDropdown({
  isAuthenticated,
  displayLabel,
  avatarLabel,
  deferUntilMounted = true,
}: UserMenuDropdownProps) {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isAuthenticated) return null
  if (deferUntilMounted && !isMounted) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-sm font-medium text-white">{avatarLabel}</span>
          </div>
          <span className="text-sm font-medium text-zinc-900">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isFeatureEnabledClient("PROFILE") && (
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex cursor-pointer items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={async () => {
            const { supabase } = await import("@/lib/supabase/client")
            await supabase.auth.signOut()
            router.push("/login")
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
