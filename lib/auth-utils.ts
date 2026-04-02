import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { createSupabaseClient } from "./supabase-client"
import type { Json } from "./supabase.types"
import type { AuthIdentifier } from "./auth/identifier"

// Create a new client instance each time to ensure fresh environment variables
const getSupabase = () => {
  return createSupabaseClient()
}

/**
 * Sign in with email or phone and password
 */
export async function signIn(identifier: AuthIdentifier, password: string) {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const signInPromise = supabase.auth.signInWithPassword({
      ...(identifier.type === "email" ? { email: identifier.value } : { phone: identifier.value }),
      password,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Authentication timeout - please check your internet connection and try again")),
        15000
      )
    )

    const result = await Promise.race([signInPromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Authentication timeout:", error.message)
        throw new Error("Connection timeout - please check your internet connection and try again")
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        let healthStatus: number | null = null
        let healthError: string | null = null

        if (supabaseUrl) {
          try {
            const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl
            const resp = await fetch(`${base}/auth/v1/health`, { method: "GET" })
            healthStatus = resp.status
          } catch (healthErr) {
            healthError = healthErr instanceof Error ? healthErr.message : String(healthErr)
          }
        }

        const host = (() => {
          try {
            return supabaseUrl ? new URL(supabaseUrl).host : null
          } catch {
            return null
          }
        })()

        console.warn("Network error during authentication:", {
          message: error.message,
          supabaseHost: host,
          healthStatus,
          healthError,
        })

        const details = [
          host ? `supabaseHost=${host}` : null,
          typeof healthStatus === "number" ? `/auth/v1/health=${healthStatus}` : null,
          healthError ? `/auth/v1/health_error=${healthError}` : null,
        ]
          .filter(Boolean)
          .join(", ")

        throw new Error(
          `Network connection failed - please check your internet connection and try again${details ? ` (${details})` : ""}`
        )
      } else if (error.message.includes("invalid login credentials")) {
        // Re-throw credential errors for UI to handle
        throw error
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Sign up with email or phone and password
 */
export async function signUp(identifier: AuthIdentifier, password: string) {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const signUpPromise = supabase.auth.signUp({
      ...(identifier.type === "email" ? { email: identifier.value } : { phone: identifier.value }),
      password,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Registration timeout - please check your internet connection and try again")),
        15000
      )
    )

    const result = await Promise.race([signUpPromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.auth.signUp>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Registration timeout:", error.message)
        throw new Error("Connection timeout - please check your internet connection and try again")
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        let healthStatus: number | null = null
        let healthError: string | null = null

        if (supabaseUrl) {
          try {
            const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl
            const resp = await fetch(`${base}/auth/v1/health`, { method: "GET" })
            healthStatus = resp.status
          } catch (healthErr) {
            healthError = healthErr instanceof Error ? healthErr.message : String(healthErr)
          }
        }

        const host = (() => {
          try {
            return supabaseUrl ? new URL(supabaseUrl).host : null
          } catch {
            return null
          }
        })()

        console.warn("Network error during registration:", {
          message: error.message,
          supabaseHost: host,
          healthStatus,
          healthError,
        })

        const details = [
          host ? `supabaseHost=${host}` : null,
          typeof healthStatus === "number" ? `/auth/v1/health=${healthStatus}` : null,
          healthError ? `/auth/v1/health_error=${healthError}` : null,
        ]
          .filter(Boolean)
          .join(", ")

        throw new Error(
          `Network connection failed - please check your internet connection and try again${details ? ` (${details})` : ""}`
        )
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const signOutPromise = supabase.auth.signOut()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Sign out timeout - please check your internet connection and try again")),
        10000
      )
    )

    const result = await Promise.race([signOutPromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.auth.signOut>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Sign out timeout:", error.message)
        throw new Error("Connection timeout during sign out - please check your internet connection")
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        console.warn("Network error during sign out:", error.message)
        throw new Error("Network connection failed during sign out - please check your internet connection")
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Reset password for an email
 */
export async function resetPassword(email: string) {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const resetPromise = supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Password reset timeout - please check your internet connection and try again")),
        15000
      )
    )

    const result = await Promise.race([resetPromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Password reset timeout:", error.message)
        throw new Error("Connection timeout - please check your internet connection and try again")
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        console.warn("Network error during password reset:", error.message)
        throw new Error("Network connection failed - please check your internet connection and try again")
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Update user password
 */
export async function updatePassword(password: string) {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const updatePromise = supabase.auth.updateUser({
      password,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Password update timeout - please check your internet connection and try again")),
        15000
      )
    )

    const result = await Promise.race([updatePromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.auth.updateUser>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Password update timeout:", error.message)
        throw new Error("Connection timeout - please check your internet connection and try again")
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        console.warn("Network error during password update:", error.message)
        throw new Error("Network connection failed - please check your internet connection and try again")
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await getSupabase()
    // Add a timeout wrapper to prevent hanging
    const getUserPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Get user timeout")), 10000))

    const {
      data: { user },
    } = (await Promise.race([getUserPromise, timeoutPromise])) as Awaited<ReturnType<typeof supabase.auth.getUser>>
    return user
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("fetch failed"))) {
      console.warn("Network issue while getting current user:", error.message)
      return null
    }
    throw error
  }
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const getSessionPromise = supabase.auth.getSession()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Session fetch timeout")), 10000)
    )

    const result = await Promise.race([getSessionPromise, timeoutPromise])
    return (result as Awaited<ReturnType<typeof supabase.auth.getSession>>).data.session
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("fetch failed"))) {
      console.warn("Network issue while getting current session:", error.message)
      return null
    }
    throw error
  }
}

/**
 * Setup a listener for auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const supabase = getSupabase()
  return supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    callback(session?.user || null)
  })
}

/**
 * Create a user profile after sign up
 */
export async function createUserProfile(
  userId: string,
  name: string,
  roleId: string = "00000000-0000-0000-0000-000000000002", // Default to "user" role
  departmentId?: string,
  metadata?: Json | null,
  phoneE164?: string
) {
  try {
    const supabase = await getSupabase()
    // Add timeout to prevent hanging requests
    const createPromise = supabase
      .from("user_profiles")
      .insert({
        user_id: userId,
        name,
        role_id: roleId,
        department_id: departmentId,
        is_active: true,
        metadata,
        phone_e164: phoneE164,
      })
      .select("*")
      .single()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Profile creation timeout - please check your internet connection and try again")),
        15000
      )
    )

    const result = await Promise.race([createPromise, timeoutPromise])
    return result as Awaited<ReturnType<typeof supabase.from>>
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("Profile creation timeout:", error.message)
        throw new Error(
          "Connection timeout during profile creation - please check your internet connection and try again"
        )
      } else if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
        console.warn("Network error during profile creation:", error.message)
        throw new Error(
          "Network connection failed during profile creation - please check your internet connection and try again"
        )
      }
    }

    // Re-throw other errors
    throw error
  }
}
