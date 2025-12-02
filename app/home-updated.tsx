"use client";

import { SupabaseLogProvider } from "@/contexts/supabase-log-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SupabaseProviders } from "@/components/supabase-providers";
import { MainLayoutUpdated } from "@/components/main-layout-updated";
import { useEffect, useState } from "react";

interface HomeUpdatedProps {
  initialRoleQuestions: any[];
}

/**
 * A wrapper component that ensures auth is initialized before rendering children
 */
function AuthInitialized({ children }: { children: React.ReactNode }) {
  const { isInitialized } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return <>{children}</>;
}

/**
 * Home component - Supabase-only architecture
 * Uses cloud storage exclusively for enterprise-grade reliability
 */
export default function HomeUpdated({ initialRoleQuestions }: HomeUpdatedProps) {
  return (
    <SupabaseProviders>
      <AuthProvider>
        <AuthInitialized>
          <SupabaseLogProvider>
            <MainLayoutUpdated initialRoleQuestions={initialRoleQuestions} />
          </SupabaseLogProvider>
        </AuthInitialized>
      </AuthProvider>
    </SupabaseProviders>
  );
}
