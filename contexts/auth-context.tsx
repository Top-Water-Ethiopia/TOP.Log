"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import type { User, Role, Permission, Session, AuthContextType, AuthState } from "@/lib/rbac/types"
import { 
  DEFAULT_ROLES, 
  DEFAULT_PERMISSIONS, 
  DEFAULT_ADMIN_USER,
  ROLE_HIERARCHY 
} from "@/lib/rbac/types"
import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  generateId,
  createSession,
  isSessionExpired,
  hashPassword,
  verifyPassword,
  isValidEmail,
  validatePassword,
  createAuthAuditLog,
  sanitizeInput,
} from "@/lib/rbac/utils"

// ==================== AUTHENTICATION CONTEXT ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    session: null,
    isLoading: true,
    error: null,
  })

  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES)
  const [permissions, setPermissions] = useState<Permission[]>(DEFAULT_PERMISSIONS)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // ==================== INITIALIZATION ====================

  const initializeAuth = useCallback(async () => {
    try {
      // Load all RBAC data from storage
      const loadedUsers = loadFromStorage("USERS", [] as User[])
      const loadedRoles = loadFromStorage("ROLES", DEFAULT_ROLES)
      const loadedPermissions = loadFromStorage("PERMISSIONS", DEFAULT_PERMISSIONS)
      const loadedSessions = loadFromStorage("SESSIONS", [] as Session[])
      const currentSession = loadFromStorage<Session | null>("CURRENT_SESSION", null)

      // Initialize default admin user if no users exist
      if (loadedUsers.length === 0) {
        const hashedPassword = await hashPassword(DEFAULT_ADMIN_USER.password)
        const adminUser: User = {
          id: generateId(),
          email: DEFAULT_ADMIN_USER.email,
          name: DEFAULT_ADMIN_USER.name,
          role: DEFAULT_ADMIN_USER.role,
          department: DEFAULT_ADMIN_USER.department,
          isActive: DEFAULT_ADMIN_USER.isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: DEFAULT_ADMIN_USER.metadata,
        }
        
        const usersWithPassword = [...loadedUsers, { ...adminUser, password: hashedPassword }]
        setUsers(usersWithPassword)
        saveToStorage("USERS", usersWithPassword)
        
        toast.info("Default admin user created", {
          description: "Email: admin@captains-log.local, Password: admin123",
          duration: 10000,
        })
      } else {
        setUsers(loadedUsers)
      }

      setRoles(loadedRoles)
      setPermissions(loadedPermissions)
      setSessions(loadedSessions)

      // Validate and restore current session
      if (currentSession && !isSessionExpired(currentSession)) {
        const user = loadedUsers.find(u => u.id === currentSession.userId)
        if (user && user.isActive) {
          setAuthState({
            isAuthenticated: true,
            user,
            session: currentSession,
            isLoading: false,
            error: null,
          })
          setIsInitialized(true)
          return
        }
      }

      // Clear invalid session
      if (currentSession) {
        removeFromStorage("CURRENT_SESSION")
      }

      setAuthState(prev => ({ ...prev, isLoading: false }))
      setIsInitialized(true)

    } catch (error) {
      console.error("Auth initialization failed:", error)
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to initialize authentication",
      }))
      setIsInitialized(true)
    }
  }, [])

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // ==================== SESSION MANAGEMENT ====================

  const updateSessionActivity = useCallback((sessionId: string) => {
    setSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, lastActivity: new Date().toISOString() }
          : session
      )
    )
  }, [])

  const cleanupExpiredSessions = useCallback(() => {
    setSessions(prev => {
      const validSessions = prev.filter(session => !isSessionExpired(session))
      if (validSessions.length !== prev.length) {
        saveToStorage("SESSIONS", validSessions)
      }
      return validSessions
    })
  }, [])

  useEffect(() => {
    if (!isInitialized) return

    const interval = setInterval(() => {
      cleanupExpiredSessions()
      
      // Check current session
      if (authState.session && isSessionExpired(authState.session)) {
        logout()
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [isInitialized, authState.session, cleanupExpiredSessions])

  // ==================== AUTHENTICATION METHODS ====================

  const login = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Validate input
      if (!email || !password) {
        throw new Error("Email and password are required")
      }

      const sanitizedEmail = sanitizeInput(email.toLowerCase()).trim()
      
      if (!isValidEmail(sanitizedEmail)) {
        throw new Error("Invalid email format")
      }

      // Find user
      const user = users.find(u => u.email.toLowerCase() === sanitizedEmail)
      if (!user) {
        throw new Error("Invalid email or password")
      }

      if (!user.isActive) {
        throw new Error("Account is deactivated")
      }

      // Verify password (for demo users with stored password)
      const userWithPassword = users.find(u => u.id === user.id) as any
      if (userWithPassword?.password) {
        const isValidPassword = await verifyPassword(password, userWithPassword.password)
        if (!isValidPassword) {
          throw new Error("Invalid email or password")
        }
      }

      // Create session
      const newSession = createSession(user.id)
      const updatedSessions = [...sessions, newSession]
      setSessions(updatedSessions)
      saveToStorage("SESSIONS", updatedSessions)
      saveToStorage("CURRENT_SESSION", newSession)

      // Update user last login
      const updatedUsers = users.map(u => 
        u.id === user.id 
          ? { ...u, lastLogin: new Date().toISOString() }
          : u
      )
      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)

      // Update auth state
      setAuthState({
        isAuthenticated: true,
        user,
        session: newSession,
        isLoading: false,
        error: null,
      })

      toast.success(`Welcome back, ${user.name}!`)

      // Create audit log
      const auditLog = createAuthAuditLog("LOGIN", user.id, { email: sanitizedEmail })
      console.log("Audit log:", auditLog)

    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed"
      setAuthState(prev => ({ ...prev, isLoading: false, error: message }))
      toast.error(message)
      throw error
    }
  }, [users, sessions])

  const logout = useCallback(() => {
    try {
      // Remove current session from storage
      removeFromStorage("CURRENT_SESSION")
      
      // Create audit log if user exists
      if (authState.user) {
        const auditLog = createAuthAuditLog("LOGOUT", authState.user.id)
        console.log("Audit log:", auditLog)
      }

      // Reset auth state
      setAuthState({
        isAuthenticated: false,
        user: null,
        session: null,
        isLoading: false,
        error: null,
      })

      toast.success("Logged out successfully")
    } catch (error) {
      console.error("Logout error:", error)
      toast.error("Error during logout")
    }
  }, [authState.user])

  const register = useCallback(async (userData: Omit<User, "id" | "createdAt" | "updatedAt"> & { password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Validate input
      const { password, ...userInfo } = userData
      
      if (!userInfo.email || !password || !userInfo.name) {
        throw new Error("All fields are required")
      }

      if (!isValidEmail(userInfo.email)) {
        throw new Error("Invalid email format")
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(", "))
      }

      // Check if user already exists
      const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())
      if (existingUser) {
        throw new Error("User with this email already exists")
      }

      // Hash password
      const hashedPassword = await hashPassword(password)

      // Create new user
      const newUser: User & { password: string } = {
        ...userInfo,
        id: generateId(),
        email: userInfo.email.toLowerCase().trim(),
        name: sanitizeInput(userInfo.name).trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        password: hashedPassword,
      }

      const updatedUsers = [...users, newUser]
      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)

      // Create audit log
      const auditLog = createAuthAuditLog("REGISTER", newUser.id, { email: newUser.email })
      console.log("Audit log:", auditLog)

      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.success("Account created successfully! You can now log in.")

    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed"
      setAuthState(prev => ({ ...prev, isLoading: false, error: message }))
      toast.error(message)
      throw error
    }
  }, [users])

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!authState.user) {
      throw new Error("Not authenticated")
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Validate updates
      if (updates.email && !isValidEmail(updates.email)) {
        throw new Error("Invalid email format")
      }

      if (updates.name) {
        updates.name = sanitizeInput(updates.name).trim()
      }

      // Check email uniqueness
      if (updates.email && updates.email !== authState.user.email) {
        const existingUser = users.find(u => 
          u.email.toLowerCase() === updates.email!.toLowerCase() && 
          u.id !== authState.user.id
        )
        if (existingUser) {
          throw new Error("Email already exists")
        }
      }

      // Update user
      const updatedUser: User = {
        ...authState.user,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      const updatedUsers = users.map(u => 
        u.id === authState.user.id ? updatedUser : u
      )
      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)

      // Update auth state
      setAuthState(prev => ({ 
        ...prev, 
        user: updatedUser, 
        isLoading: false, 
        error: null 
      }))

      toast.success("Profile updated successfully")

    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile update failed"
      setAuthState(prev => ({ ...prev, isLoading: false, error: message }))
      toast.error(message)
      throw error
    }
  }, [authState.user, users])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!authState.user) {
      throw new Error("Not authenticated")
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Validate new password
      const passwordValidation = validatePassword(newPassword)
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(", "))
      }

      // Get user with password
      const userWithPassword = users.find(u => u.id === authState.user.id) as any
      
      if (userWithPassword?.password) {
        // Verify old password
        const isValidOldPassword = await verifyPassword(oldPassword, userWithPassword.password)
        if (!isValidOldPassword) {
          throw new Error("Current password is incorrect")
        }

        // Hash new password
        const hashedNewPassword = await hashPassword(newPassword)
        
        // Update user password
        const updatedUsers = users.map(u => 
          u.id === authState.user.id 
            ? { ...u, password: hashedNewPassword, updatedAt: new Date().toISOString() }
            : u
        )
        setUsers(updatedUsers)
        saveToStorage("USERS", updatedUsers)
      }

      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.success("Password changed successfully")

      // Create audit log
      const auditLog = createAuthAuditLog("PASSWORD_CHANGE", authState.user.id)
      console.log("Audit log:", auditLog)

    } catch (error) {
      const message = error instanceof Error ? error.message : "Password change failed"
      setAuthState(prev => ({ ...prev, isLoading: false, error: message }))
      toast.error(message)
      throw error
    }
  }, [authState.user, users])

  const refreshToken = useCallback(async () => {
    if (!authState.session || !authState.user) {
      throw new Error("No active session")
    }

    try {
      // Create new session
      const newSession = createSession(authState.user.id)
      
      // Update sessions
      const updatedSessions = sessions.filter(s => s.id !== authState.session!.id).concat(newSession)
      setSessions(updatedSessions)
      saveToStorage("SESSIONS", updatedSessions)
      saveToStorage("CURRENT_SESSION", newSession)

      // Update auth state
      setAuthState(prev => ({ ...prev, session: newSession }))

    } catch (error) {
      console.error("Token refresh failed:", error)
      logout()
    }
  }, [authState.session, authState.user, sessions, logout])

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }))
  }, [])

  // ==================== CONTEXT VALUE ====================

  const contextValue: AuthContextType = {
    ...authState,
    isInitialized,
    login,
    logout,
    register,
    updateProfile,
    changePassword,
    refreshToken,
    clearError,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// ==================== HOOK ====================

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// ==================== HIGHER-ORDER COMPONENT ====================

export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function AuthenticatedComponent(props: T) {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
      return <div>Loading...</div>
    }

    if (!isAuthenticated) {
      return <div>Please log in to access this content.</div>
    }

    return <Component {...props} />
  }
}
