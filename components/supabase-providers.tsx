'use client';

import { ReactNode } from 'react';
import { SupabaseAuthProvider } from '@/contexts/supabase-auth-context';
import { SupabaseLogProvider } from '@/contexts/supabase-log-context';

interface SupabaseProvidersProps {
  children: ReactNode;
}

/**
 * Combines all Supabase-related context providers
 * This makes it easy to add Supabase functionality to the application
 */
export function SupabaseProviders({ children }: SupabaseProvidersProps) {
  return (
    <SupabaseAuthProvider>
      <SupabaseLogProvider>
        {children}
      </SupabaseLogProvider>
    </SupabaseAuthProvider>
  );
}
