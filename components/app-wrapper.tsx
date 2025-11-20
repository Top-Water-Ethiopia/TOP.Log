'use client';

import { ReactNode } from 'react';
import { Providers } from '@/components/providers';

interface AppWrapperProps {
  children: ReactNode;
}

function AppWrapper({ children }: AppWrapperProps) {
  return (
    <Providers>
      {children}
    </Providers>
  );
}

export default AppWrapper;
export { AppWrapper };
