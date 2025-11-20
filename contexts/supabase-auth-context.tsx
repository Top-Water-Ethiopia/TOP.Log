"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
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
        const user = await getCurrentUser();
        if (user) {
          const { data: session } = await supabase.auth.getSession();
          
          // Try to get profile, or create one if it doesn't exist
          let { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          // If profile doesn't exist, create a default one
          if (!profile && !profileError) {
            const { data: newProfile, error: createError } = await supabase
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
            session: session.session,
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
      } catch (error) {
        console.error("Auth initialization error:", error);
        setAuthState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: "Failed to initialize authentication",
        });
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = onAuthStateChange(async (user: User | null) => {
      if (user) {
        // Try to get profile, or create one if it doesn't exist
        let { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        // If profile doesn't exist, create a default one
        if (!profile) {
          const { data: newProfile } = await supabase
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

        setAuthState(prev => ({
          ...prev,
          user,
          profile: profile || null,
          isLoading: false,
        }));
      } else {
        setAuthState(prev => ({
          ...prev,
          user: null,
          profile: null,
          session: null,
          isLoading: false,
        }));
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email: string, password: string, redirectTo: string = '/') => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { session, user } = await signIn(email, password);
      
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
      let { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // If profile doesn't exist, create a default one
      if (!profile) {
        const { data: newProfile } = await supabase
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
        await supabase
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
      toast.error("Error during logout");
    }
  };
  
  // Register function
  const register = async (email: string, password: string, name: string, department?: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Create user in Supabase Auth
      const { user } = await signUp(email, password);
      
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
      const { data: updatedProfile, error } = await supabase
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
      const { data: profile, error } = await supabase
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
