'use client';

import { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/components/theme-provider';
import { SupabaseProviders } from '@/components/supabase-providers';
import { apiFetch } from '@/lib/api-client';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers component that combines all application providers
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem
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
          {children}
        </SupabaseProviders>
      </SWRConfig>
    </ThemeProvider>
  );
}
