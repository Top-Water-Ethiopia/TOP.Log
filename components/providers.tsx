"use client"

import { ReactNode } from "react"
import { SWRConfig } from "swr"
import { ThemeProvider } from "@/components/theme-provider"
import { SupabaseProviders } from "@/components/supabase-providers"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { Toaster } from "@/components/ui/toaster"
import { apiFetch } from "@/lib/api-client"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"

interface ProvidersProps {
  children: ReactNode
}

/**
 * Root providers component that combines all application providers
 */
export function Providers({ children }: ProvidersProps) {
  const darkModeEnabled = isFeatureEnabledClient("DARK_MODE")

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={darkModeEnabled}
      forcedTheme={darkModeEnabled ? undefined : "light"}
      disableTransitionOnChange
    >
      <SWRConfig
        value={{
          fetcher: (resource: string) => apiFetch(resource),
          revalidateOnFocus: false,
          shouldRetryOnError: false,
        }}
      >
        <SupabaseProviders>
          <AuthProvider>{children}</AuthProvider>
          <SonnerToaster />
          <Toaster />
        </SupabaseProviders>
      </SWRConfig>
    </ThemeProvider>
  )
}
