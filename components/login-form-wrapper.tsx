'use client';

import { Suspense } from 'react';
import LoginForm from './login-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginFormWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40 bg-gray-200/80 dark:bg-gray-800" />
              <Skeleton className="h-4 w-56 bg-gray-200/70 dark:bg-gray-800" />
            </div>
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 bg-gray-200/70 dark:bg-gray-800" />
                <Skeleton className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
              </div>
              <Skeleton className="h-10 w-full bg-gray-200/80 dark:bg-gray-800" />
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}