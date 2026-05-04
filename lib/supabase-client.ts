import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./supabase.types"

// Supabase client setup with type safety and SSR cookie support
export const createSupabaseClient = () => {
  // Industry standard: validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL (must be a valid URL)")
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL protocol (${parsedUrl.protocol}). Use the Supabase API URL (https://<project-ref>.supabase.co), not a database/pooler URL.`
    )
  }

  const host = parsedUrl.hostname.toLowerCase()
  if (host.includes("pooler.supabase.com") || supabaseUrl.startsWith("postgres")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL looks like a database/pooler URL. Use the Supabase API URL from Project Settings → API (https://<project-ref>.supabase.co)."
    )
  }

  // Basic sanity check: anon keys are JWT-like
  if (!supabaseAnonKey.startsWith("eyJ")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a valid Supabase anon key (JWT)")
  }

  // Use createBrowserClient from @supabase/ssr for proper cookie handling
  // This ensures sessions sync between client and server (middleware)
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.delete("X-Client-Info")
        headers.delete("x-client-info")
        return fetch(input, {
          ...init,
          headers,
        })
      },
    },
  })
}

// For client-side usage - browser environments with SSR cookie support
export const supabase = createSupabaseClient()

// Type-safe helper functions
export type SupabaseClient = ReturnType<typeof createSupabaseClient>
