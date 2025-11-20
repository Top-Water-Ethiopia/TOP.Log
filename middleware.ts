import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// This middleware protects routes and handles authentication sessions
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client configured for middleware (using SSR package)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  // Refresh session if it exists
  const { data: { session } } = await supabase.auth.getSession();

  // Authentication logic for protected routes
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login') || 
                    req.nextUrl.pathname.startsWith('/register') ||
                    req.nextUrl.pathname.startsWith('/reset-password');
                    
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  
  // If accessing a protected route without a session, redirect to login
  const isProtectedRoute = !isAuthRoute && !isApiRoute && !req.nextUrl.pathname.startsWith('/_next') && !req.nextUrl.pathname.endsWith('.ico');
  
  if (!session && isProtectedRoute) {
    const loginUrl = new URL('/login', req.url);
    // Only set redirect for non-root paths to avoid redirect loops
    if (req.nextUrl.pathname !== '/') {
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }
  
  // If accessing auth routes with a valid session, redirect to dashboard
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    // Protected routes
    '/',
    '/entries/:path*',
    '/settings/:path*',
    '/profile',
    // Auth routes
    '/login',
    '/register',
    '/reset-password',
    // Skip static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
