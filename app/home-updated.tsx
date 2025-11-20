"use client";

import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { AuthProvider } from "@/contexts/auth-context";
import { SupabaseProviders } from "@/components/supabase-providers";
import { MainLayoutUpdated } from "@/components/main-layout-updated";

/**
 * Home component - Supabase-only architecture
 * Uses cloud storage exclusively for enterprise-grade reliability
 * 
 * Note: AuthProvider is included for legacy RBAC system compatibility
 * TODO: Migrate useRBAC to use Supabase auth directly
 */
export default function HomeUpdated() {
  return (
    <SupabaseProviders>
      <AuthProvider>
        <CaptainLogProvider>
          <MainLayoutUpdated />
        </CaptainLogProvider>
      </AuthProvider>
    </SupabaseProviders>
  );
}
