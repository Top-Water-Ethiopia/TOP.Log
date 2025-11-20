import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './supabase.types';

// Supabase client setup with type safety and SSR cookie support
export const createSupabaseClient = () => {
  // Industry standard: validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  // Use createBrowserClient from @supabase/ssr for proper cookie handling
  // This ensures sessions sync between client and server (middleware)
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
};

// For client-side usage - browser environments with SSR cookie support
export const supabase = createSupabaseClient();

// Type-safe helper functions
export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
