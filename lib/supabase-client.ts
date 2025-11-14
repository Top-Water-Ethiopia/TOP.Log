import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

// Supabase client setup with type safety
export const createSupabaseClient = () => {
  // Industry standard: validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
};

// For client-side usage - browser environments
export const supabase = createSupabaseClient();

// Type-safe helper functions
export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
