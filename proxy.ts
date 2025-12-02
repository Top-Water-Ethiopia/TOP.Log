import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// This proxy protects routes and handles authentication sessions
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client configured for proxy (using SSR package)
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

  // Refresh session if it exists - with error handling for network failures
  let session = null;
  try {
    // Add timeout to prevent hanging requests
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    );
    
    const { data } = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any } };
    session = data?.session || null;
  } catch (error: any) {
    // Handle network errors gracefully - don't block requests if Supabase is unreachable
    // Only log if it's not a timeout or network error (status 0)
    if (error?.status !== 0 && !error?.message?.includes('timeout') && !error?.message?.includes('fetch failed')) {
      console.error('Middleware session fetch error:', error);
    }
    // Continue without session - let the route handle authentication
    session = null;
  }

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

// Specify which routes this proxy should run on
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
