"use client";

import { SupabaseLogProvider } from "@/contexts/supabase-log-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SupabaseProviders } from "@/components/supabase-providers";
import { MainLayoutUpdated } from "@/components/main-layout-updated";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-40 bg-gray-200/80 dark:bg-gray-800" />
                <Skeleton className="h-4 w-24 bg-gray-200/60 dark:bg-gray-800" />
              </div>
              <Skeleton className="h-9 w-36 bg-gray-200/70 dark:bg-gray-800" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-3 w-56 bg-gray-200/60 dark:bg-gray-800" />
                </div>
              </div>
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-28 bg-gray-200/70 dark:bg-gray-800" />
                  <Skeleton className="h-3 w-56 bg-gray-200/60 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
