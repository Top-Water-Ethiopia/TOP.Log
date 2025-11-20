"use client"

import { useEffect, useState } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase, getCurrentUser } from "@/lib/supabase/client"

type Profile = {
  id: string
  user_id: string
  name: string
  role_id: string
  role_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and set the user
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (session?.user) {
          setUser(session.user)
          await fetchUserProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        setIsLoading(false)
      }
    )

    // Fetch the initial user
    const fetchUser = async () => {
      const user = await getCurrentUser()
      if (user) {
        setUser(user)
        await fetchUserProfile(user.id)
      }
      setIsLoading(false)
    }

    fetchUser()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      setProfile(data)
    } else if (error && error.code !== 'PGRST116') {
      // Only log unexpected errors
      console.error('Error fetching user profile:', error)
    } else {
      setProfile(null)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return {
    user,
    profile,
    isLoading,
    signOut,
    isAuthenticated: !!user,
    isAdmin: profile?.role_name === 'admin' || profile?.role_id === '00000000-0000-0000-0000-000000000001',
  }
}
