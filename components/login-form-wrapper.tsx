'use client';

import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginFormWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background p-4">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}