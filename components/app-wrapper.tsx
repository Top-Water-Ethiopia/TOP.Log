'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Providers } from '@/components/providers';

interface AppWrapperProps {
  children: ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  return (
    <ErrorBoundary>
      <Providers>
        {children}
      </Providers>
    </ErrorBoundary>
  );
}
