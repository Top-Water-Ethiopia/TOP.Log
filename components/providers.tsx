'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { SupabaseProviders } from '@/components/supabase-providers';

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
      <SupabaseProviders>
        {children}
      </SupabaseProviders>
    </ThemeProvider>
  );
}
