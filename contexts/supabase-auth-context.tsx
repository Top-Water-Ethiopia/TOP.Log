"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { User, Session } from "@supabase/supabase-js"
import { createSupabaseClient } from "@/lib/supabase-client"
import { signIn, signOut, signUp, onAuthStateChange, getCurrentUser, createUserProfile } from "@/lib/auth-utils"
import { getAuthIdentifierError, parseAuthIdentifier } from "@/lib/auth/identifier"

// Define types for our auth context
interface UserProfile {
  id: string
  user_id: string
  name: string
  department_id: string | null
  role_id: string
  role_name?: string | null
  roles?: {
    id: string
    name: string
    description: string | null
  } | null
  is_active: boolean
  metadata: any | null
  last_login: string | null
  created_at?: string
  updated_at?: string
  avatar?: string | null
  phone_e164?: string | null
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string, redirectTo?: string) => Promise<void>
  logout: () => Promise<void>
  register: (identifier: string, password: string, name: string, departmentId?: string) => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<void>
  refreshProfile: () => Promise<void>
  resetAuthError: () => void
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth provider component
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  // Auth state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    error: null,
  })

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Add timeout to prevent hanging on network errors
        const getUserPromise = getCurrentUser()
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Auth initialization timeout")), 15000) // Increased to 15 seconds
        )

        const user = (await Promise.race([getUserPromise, timeoutPromise])) as Awaited<
          ReturnType<typeof getCurrentUser>
        >

        if (user) {
          let session = null
          try {
            const localSupabase = createSupabaseClient()
            const sessionPromise = localSupabase.auth.getSession()
            const sessionTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Session fetch timeout")), 5000)
            )
            const { data } = (await Promise.race([sessionPromise, sessionTimeoutPromise])) as { data: { session: any } }
            session = data?.session || null
          } catch (sessionError: any) {
            // Handle session fetch errors gracefully
            if (sessionError?.status !== 0 && !sessionError?.message?.includes("timeout")) {
              console.error("Session fetch error:", sessionError)
            }
            // Continue without session - user is still authenticated
          }

          // Try to get profile, or create one if it doesn't exist
          const localSupabase = createSupabaseClient()
          let { data: profile, error: profileError } = await localSupabase
            .from("user_profiles")
            .select(
              `
              *,
              roles:role_id (
                id,
                name,
                description
              )
            `
            )
            .eq("user_id", user.id)
            .maybeSingle()

          // If profile doesn't exist, create a default one
          if (!profile && !profileError) {
            const localSupabase = createSupabaseClient()
            const { data: newProfile, error: createError } = await localSupabase
              .from("user_profiles")
              .insert({
                user_id: user.id,
                name: user.email?.split("@")[0] || user.phone || "User",
                role_id: "00000000-0000-0000-0000-000000000002", // Default user role
                department_id: null,
                is_active: true,
                phone_e164: user.phone ?? null,
              })
              .select(
                `
                *,
                roles:role_id (
                  id,
                  name,
                  description
                )
              `
              )
              .single()

            if (createError) {
              console.error("Failed to create user profile:", createError)
            } else {
              profile = newProfile
            }
          }

          setAuthState({
            user,
            profile: profile || null,
            session: session,
            isLoading: false,
            error: null,
          })

          // Console.log user and profile for testing (local development only)
          if (process.env.NODE_ENV === "development") {
            console.log("=== USER AUTH DATA ===")
            console.log("Supabase User:", user)
            console.log("User Profile:", profile)
            console.log("User ID:", user?.id)
            console.log("User Email:", user?.email)
            console.log("Profile Role ID:", profile?.role_id)
            console.log("Profile Role Name:", profile?.roles?.name)
            console.log("Profile Department ID:", profile?.department_id)
            console.log("Profile Active:", profile?.is_active)
            console.log("=====================")
          }
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          })
        }
      } catch (error: any) {
        // Handle timeout and network errors more gracefully
        console.error("Auth initialization error:", error)

        // For timeout or network errors, we still want to show the app
        // rather than keeping it in a loading state
        const isNetworkError =
          error?.message?.includes("timeout") || error?.message?.includes("fetch failed") || error?.status === 0

        setAuthState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: isNetworkError ? null : "Failed to initialize authentication", // Don't show error for network issues
        })
      }
    }

    initializeAuth()

    // Set up auth state change listener
    const {
      data: { subscription },
    } = onAuthStateChange(async (user: User | null) => {
      try {
        if (user) {
          // Try to get profile, or create one if it doesn't exist
          let profile: UserProfile | null = null
          try {
            const localSupabase = createSupabaseClient()
            const { data: profileData, error: profileError } = await localSupabase
              .from("user_profiles")
              .select(
                `
                *,
                roles:role_id (
                  id,
                  name,
                  description
                )
              `
              )
              .eq("user_id", user.id)
              .maybeSingle()

            profile = profileData || null

            // If profile doesn't exist and no error, create a default one
            if (!profile && !profileError) {
              try {
                const localSupabase = createSupabaseClient()
                const { data: newProfile, error: createError } = await localSupabase
                  .from("user_profiles")
                  .insert({
                    user_id: user.id,
                    name: user.email?.split("@")[0] || user.phone || "User",
                    role_id: "00000000-0000-0000-0000-000000000002", // Default user role
                    department_id: null,
                    is_active: true,
                    phone_e164: user.phone ?? null,
                  })
                  .select(
                    `
                    *,
                    roles:role_id (
                      id,
                      name,
                      description
                    )
                  `
                  )
                  .single()

                if (!createError) {
                  profile = newProfile
                }
              } catch (createErr: any) {
                // Only log if it's not a network error
                if (createErr?.status !== 0 && !createErr?.message?.includes("fetch failed")) {
                  console.error("Failed to create user profile:", createErr)
                }
              }
            }
          } catch (profileErr: any) {
            // Only log if it's not a network error
            if (profileErr?.status !== 0 && !profileErr?.message?.includes("fetch failed")) {
              console.error("Error fetching user profile:", profileErr)
            }
          }

          setAuthState((prev) => ({
            ...prev,
            user,
            profile: profile || null,
            isLoading: false,
          }))

          // Console.log user and profile for testing (local development only)
          if (process.env.NODE_ENV === "development") {
            console.log("=== USER AUTH DATA (STATE CHANGE) ===")
            console.log("Supabase User:", user)
            console.log("User Profile:", profile)
            console.log("User ID:", user?.id)
            console.log("User Email:", user?.email)
            console.log("Profile Role ID:", profile?.role_id)
            console.log("Profile Role Name:", profile?.roles?.name)
            console.log("Profile Department ID:", profile?.department_id)
            console.log("Profile Active:", profile?.is_active)
            console.log("=====================================")
          }
        } else {
          setAuthState((prev) => ({
            ...prev,
            user: null,
            profile: null,
            session: null,
            isLoading: false,
          }))
        }
      } catch (error: any) {
        // Handle unexpected errors in auth state change
        if (error?.status !== 0 && !error?.message?.includes("fetch failed")) {
          console.error("Auth state change error:", error)
        }
        // Still update state to reflect no user if we can't fetch profile
        if (!user) {
          setAuthState((prev) => ({
            ...prev,
            user: null,
            profile: null,
            session: null,
            isLoading: false,
          }))
        }
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Login function
  const login = async (identifierInput: string, password: string, redirectTo: string = "/") => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const identifier = parseAuthIdentifier(identifierInput)

      if (!identifier) {
        const message = getAuthIdentifierError(identifierInput)
        setAuthState((prev) => ({ ...prev, isLoading: false, error: message }))
        toast.error(message)
        return
      }

      const { data, error } = await signIn(identifier, password)

      if (error) {
        throw error
      }

      const { session, user } = data

      if (!user || !session) {
        // Invalid credentials: handle gracefully without throwing
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Invalid email/phone or password",
        }))
        toast.error("Invalid email/phone or password")
        return
      }

      // Get user profile, or create one if it doesn't exist
      const localSupabase = createSupabaseClient()
      let { data: profile } = await localSupabase
        .from("user_profiles")
        .select(
          `
          *,
          roles:role_id (
            id,
            name,
            description
          )
        `
        )
        .eq("user_id", user.id)
        .maybeSingle()

      // If profile doesn't exist, create a default one
      if (!profile) {
        const localSupabase = createSupabaseClient()
        const { data: newProfile } = await localSupabase
          .from("user_profiles")
          .insert({
            user_id: user.id,
            name: user.email?.split("@")[0] || user.phone || "User",
            role_id: "00000000-0000-0000-0000-000000000002", // Default user role
            department_id: null,
            is_active: true,
            phone_e164: user.phone ?? null,
          })
          .select(
            `
            *,
            roles:role_id (
              id,
              name,
              description
            )
          `
          )
          .single()

        profile = newProfile
      }

      // Update last login time
      if (profile) {
        const localSupabase = createSupabaseClient()
        await localSupabase
          .from("user_profiles")
          .update({ last_login: new Date().toISOString() })
          .eq("user_id", user.id)
      }

      setAuthState({
        user,
        profile,
        session,
        isLoading: false,
        error: null,
      })

      toast.success(`Welcome back, ${profile?.name || identifier.value}!`)
      router.push(redirectTo) // Redirect to the requested URL or dashboard
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Login failed"
      const isInvalidCreds =
        message.toLowerCase().includes("invalid login credentials") ||
        (typeof error?.status === "number" && error.status === 400)

      if (!isInvalidCreds) {
        console.error("Login error:", error)
      }

      const uiMessage = isInvalidCreds ? "Invalid email/phone or password" : message

      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: uiMessage,
      }))

      toast.error(uiMessage)
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await signOut()
      router.push("/login")
      toast.success("Logged out successfully")
    } catch (error: any) {
      console.error("Logout error:", error)
      toast.error("Error during logout")
    }
  }

  // Register function
  const register = async (identifierInput: string, password: string, name: string, departmentId?: string) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const identifier = parseAuthIdentifier(identifierInput)

      if (!identifier) {
        const message = getAuthIdentifierError(identifierInput)
        setAuthState((prev) => ({ ...prev, isLoading: false, error: message }))
        toast.error(message)
        return
      }

      // Create user in Supabase Auth
      const { data, error } = await signUp(identifier, password)

      if (error) {
        throw error
      }

      const { user } = data

      if (!user) {
        throw new Error("Registration failed")
      }

      // Create user profile
      await createUserProfile(
        user.id,
        name,
        "00000000-0000-0000-0000-000000000002", // Default user role
        departmentId,
        null,
        identifier.type === "phone" ? identifier.value : undefined
      )

      setAuthState((prev) => ({ ...prev, isLoading: false }))
      toast.success("Account created successfully! You can now log in.")
      router.push("/login")
    } catch (error: any) {
      console.error("Registration error:", error)
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Registration failed",
      }))
      toast.error(error.message || "Registration failed")
    }
  }

  // Update profile function
  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!authState.user) {
      throw new Error("Not authenticated")
    }

    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const localSupabase = createSupabaseClient()
      const { data: updatedProfile, error } = await localSupabase
        .from("user_profiles")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", authState.user.id)
        .select(
          `
          *,
          roles:role_id (
            id,
            name,
            description
          )
        `
        )
        .single()

      if (error) throw error

      setAuthState((prev) => ({
        ...prev,
        profile: updatedProfile,
        isLoading: false,
      }))

      toast.success("Profile updated successfully")
    } catch (error: any) {
      console.error("Profile update error:", error)
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Profile update failed",
      }))
      toast.error(error.message || "Profile update failed")
    }
  }

  // Refresh profile function
  const refreshProfile = async () => {
    if (!authState.user) return

    try {
      const localSupabase = createSupabaseClient()
      const { data: profile, error } = await localSupabase
        .from("user_profiles")
        .select(
          `
          *,
          roles:role_id (
            id,
            name,
            description
          )
        `
        )
        .eq("user_id", authState.user.id)
        .single()

      if (error) throw error

      setAuthState((prev) => ({
        ...prev,
        profile,
      }))
    } catch (error) {
      console.error("Profile refresh error:", error)
    }
  }

  // Reset auth error
  const resetAuthError = () => {
    setAuthState((prev) => ({ ...prev, error: null }))
  }

  // Context value
  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    register,
    updateProfile,
    refreshProfile,
    resetAuthError,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useSupabaseAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider")
  }

  return context
}
