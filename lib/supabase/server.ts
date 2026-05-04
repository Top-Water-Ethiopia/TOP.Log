import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

export const createClient = async () => {
  try {
    const cookieStore = await cookies()

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase environment variables")
    }

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const originalGetUser = supabase.auth.getUser.bind(supabase.auth)
    supabase.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
      try {
        return await originalGetUser(...args)
      } catch (err: unknown) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined

        if (code === "refresh_token_not_found") {
          return { data: { user: null }, error: err } as Awaited<ReturnType<typeof originalGetUser>>
        }
        throw err
      }
    }) as typeof supabase.auth.getUser

    const originalGetSession = supabase.auth.getSession.bind(supabase.auth)
    supabase.auth.getSession = (async (...args: Parameters<typeof originalGetSession>) => {
      try {
        return await originalGetSession(...args)
      } catch (err: unknown) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined

        if (code === "refresh_token_not_found") {
          return { data: { session: null }, error: err } as Awaited<ReturnType<typeof originalGetSession>>
        }
        throw err
      }
    }) as typeof supabase.auth.getSession

    return supabase
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    throw error
  }
}
