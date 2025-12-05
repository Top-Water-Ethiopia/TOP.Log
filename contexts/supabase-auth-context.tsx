"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User, Session } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase-client";
import { signIn, signOut, signUp, onAuthStateChange, getCurrentUser, createUserProfile } from "@/lib/auth-utils";

// Define types for our auth context
interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  department: string | null;
  role_id: string;
  is_active: boolean;
  metadata: any | null;
  last_login: string | null;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, department?: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetAuthError: () => void;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  // Auth state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    error: null,
  });

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Add timeout to prevent hanging on network errors
        const getUserPromise = getCurrentUser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 15000) // Increased to 15 seconds
        );
        
        const user = await Promise.race([getUserPromise, timeoutPromise]) as Awaited<ReturnType<typeof getCurrentUser>>;
        
        if (user) {
          let session = null;
          try {
            const localSupabase = createSupabaseClient();
            const sessionPromise = localSupabase.auth.getSession();
            const sessionTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
            );
            const { data } = await Promise.race([sessionPromise, sessionTimeoutPromise]) as { data: { session: any } };
            session = data?.session || null;
          } catch (sessionError: any) {
            // Handle session fetch errors gracefully
            if (sessionError?.status !== 0 && !sessionError?.message?.includes('timeout')) {
              console.error("Session fetch error:", sessionError);
            }
            // Continue without session - user is still authenticated
          }
          
          // Try to get profile, or create one if it doesn't exist
          const localSupabase = createSupabaseClient();
          let { data: profile, error: profileError } = await localSupabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          // If profile doesn't exist, create a default one
          if (!profile && !profileError) {
            const localSupabase = createSupabaseClient();
            const { data: newProfile, error: createError } = await localSupabase
              .from('user_profiles')
              .insert({
                user_id: user.id,
                name: user.email?.split('@')[0] || 'User',
                role_id: '00000000-0000-0000-0000-000000000002', // Default user role
                is_active: true,
              })
              .select('*')
              .single();
            
            if (createError) {
              console.error("Failed to create user profile:", createError);
            } else {
              profile = newProfile;
            }
          }

          setAuthState({
            user,
            profile: profile || null,
            session: session,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error: any) {
        // Handle timeout and network errors more gracefully
        console.error("Auth initialization error:", error);
        
        // For timeout or network errors, we still want to show the app
        // rather than keeping it in a loading state
        const isNetworkError = error?.message?.includes('timeout') || 
                              error?.message?.includes('fetch failed') ||
                              error?.status === 0;
        
        setAuthState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: isNetworkError ? null : "Failed to initialize authentication", // Don't show error for network issues
        });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string, redirectTo: string = '/') => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        throw error;
      }
      
      const { session, user } = data;
      
      if (!user || !session) {
        // Invalid credentials: handle gracefully without throwing
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Invalid email or password',
        }));
        toast.error('Invalid email or password');
        return;
      }
      
      // Get user profile, or create one if it doesn't exist
      const localSupabase = createSupabaseClient();
      let { data: profile } = await localSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // If profile doesn't exist, create a default one
      if (!profile) {
        const localSupabase = createSupabaseClient();
        const { data: newProfile } = await localSupabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            name: user.email?.split('@')[0] || 'User',
            role_id: '00000000-0000-0000-0000-000000000002', // Default user role
            is_active: true,
          })
          .select('*')
          .single();
        
        profile = newProfile;
      }
      
      // Update last login time
      if (profile) {
        const localSupabase = createSupabaseClient();
        await localSupabase
          .from('user_profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('user_id', user.id);
      }
      
      setAuthState({
        user,
        profile,
        session,
        isLoading: false,
        error: null,
      });
      
      toast.success(`Welcome back, ${profile?.name || email}!`);
      router.push(redirectTo); // Redirect to the requested URL or dashboard
      
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Login failed';
      const isInvalidCreds = message.toLowerCase().includes('invalid login credentials') || (typeof error?.status === 'number' && error.status === 400);

      if (!isInvalidCreds) {
        console.error('Login error:', error);
      }

      const uiMessage = isInvalidCreds ? 'Invalid email or password' : message;

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: uiMessage,
      }));

      toast.error(uiMessage);
    }
  };
  
  // Logout function
  const logout = async () => {
    try {
      await signOut();
      router.push('/login');
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Logout error:", error);
      // Even if sign out fails, redirect to login page for security
      router.push('/login');
      
      // Show appropriate error message based on error type
      if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        toast.error("Network connection issue during logout. You have been redirected to the login page for security.");
      } else {
        toast.error("Error during logout. You have been redirected to the login page for security.");
      }
    }
  };
  
  // Register function
  const register = async (email: string, password: string, name: string, department?: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Create user in Supabase Auth
      const { data, error } = await signUp(email, password);
      
      if (error) {
        throw error;
      }
      
      const { user } = data;
      
      if (!user) {
        throw new Error("Registration failed");
      }
      
      // Create user profile
      await createUserProfile(
        user.id,
        name,
        '00000000-0000-0000-0000-000000000002', // Default user role
        department
      );
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      toast.success("Account created successfully! You can now log in.");
      router.push('/login');
      
    } catch (error: any) {
      console.error("Registration error:", error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || "Registration failed",
      }));
      toast.error(error.message || "Registration failed");
    }
  };
  
  // Update profile function
  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!authState.user) {
      throw new Error("Not authenticated");
    }
    
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const localSupabase = createSupabaseClient();
      const { data: updatedProfile, error } = await localSupabase
        .from('user_profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', authState.user.id)
        .select('*')
        .single();
        
      if (error) throw error;
      
      setAuthState(prev => ({
        ...prev,
        profile: updatedProfile,
        isLoading: false,
      }));
      
      toast.success("Profile updated successfully");
      
    } catch (error: any) {
      console.error("Profile update error:", error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || "Profile update failed",
      }));
      toast.error(error.message || "Profile update failed");
    }
  };
  
  // Refresh profile function
  const refreshProfile = async () => {
    if (!authState.user) return;
    
    try {
      const localSupabase = createSupabaseClient();
      const { data: profile, error } = await localSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authState.user.id)
        .single();
        
      if (error) throw error;
      
      setAuthState(prev => ({
        ...prev,
        profile,
      }));
      
    } catch (error) {
      console.error("Profile refresh error:", error);
    }
  };
  
  // Reset auth error
  const resetAuthError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };
  
  // Context value
  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    register,
    updateProfile,
    refreshProfile,
    resetAuthError,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  
  return context;
}
