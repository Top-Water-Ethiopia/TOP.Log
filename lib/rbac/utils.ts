"use client"

import type {
  User,
  Role,
  CustomQuestion,
  RoleQuestionSet,
  QuestionResponse,
  PermissionCheck,
  RoleHierarchy,
  Department,
  AccessScope,
} from "./types"
import { DEFAULT_QUESTION_SETS, DEFAULT_DEPARTMENTS, DEFAULT_ACCESS_SCOPES } from "./types"

// ==================== PERMISSION CHECKING UTILITIES ====================

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: User | null, permission: string, roles: Role[] = []): boolean {
  if (!user || !user.isActive) return false

  const userRole = roles.find((role) => role.name === user.role)
  if (!userRole) return false

  return userRole.permissions.includes(permission)
}

/**
 * Check if a user can perform an action on a resource
 */
export function canPerformAction(
  user: User | null,
  check: PermissionCheck,
  roles: Role[] = [],
  resourceOwnerId?: string
): boolean {
  if (!user || !user.isActive) return false

  const permission = `${check.resource}.${check.action}`

  // Check for direct permission
  if (hasPermission(user, permission, roles)) {
    return true
  }

  // Check ownership-based permissions
  if (check.ownResource && resourceOwnerId === user.id) {
    const ownPermission = `${check.resource}.${check.action}.own`
    if (hasPermission(user, ownPermission, roles)) {
      return true
    }
  }

  return false
}

/**
 * Check if a user has a role level equal to or higher than required
 */
export function hasRoleLevel(user: User | null, requiredLevel: number, roleHierarchy: RoleHierarchy): boolean {
  if (!user || !user.isActive) return false

  const userLevel = roleHierarchy[user.role] || 0
  return userLevel >= requiredLevel
}

/**
 * Check if a user can manage another user (role hierarchy based)
 */
export function canManageUser(manager: User | null, targetUser: User | null, roleHierarchy: RoleHierarchy): boolean {
  if (!manager || !targetUser || !manager.isActive) return false

  const managerLevel = roleHierarchy[manager.role] || 0
  const targetLevel = roleHierarchy[targetUser.role] || 0

  return managerLevel > targetLevel
}

/**
 * Get all permissions for a user
 */
export function getUserPermissions(user: User | null, roles: Role[] = []): string[] {
  if (!user || !user.isActive) return []

  const userRole = roles.find((role) => role.name === user.role)
  return userRole?.permissions || []
}

/**
 * Filter resources based on user permissions
 */
export function filterByPermission<T extends { id: string; userId?: string }>(
  resources: T[],
  user: User | null,
  permission: string,
  roles: Role[] = []
): T[] {
  if (!user) return []

  const userPermissions = getUserPermissions(user, roles)

  // If user has general permission, return all
  if (userPermissions.includes(permission)) {
    return resources
  }

  // Check for own-specific permission
  const ownPermission = `${permission}.own`
  if (userPermissions.includes(ownPermission)) {
    return resources.filter((resource) => resource.userId === user.id)
  }

  return []
}

// ==================== ROLE MANAGEMENT UTILITIES ====================

/**
 * Get role by name
 */
export function getRoleByName(roleName: string, roles: Role[] = []): Role | undefined {
  return roles.find((role) => role.name === roleName)
}

/**
 * Get roles that a user can assign to others (based on hierarchy)
 */
export function getAssignableRoles(user: User | null, allRoles: Role[] = [], roleHierarchy: RoleHierarchy): Role[] {
  if (!user) return []

  const userLevel = roleHierarchy[user.role] || 0
  return allRoles.filter((role) => role.level < userLevel)
}

/**
 * Check if a role is a system role
 */
export function isSystemRole(roleName: string, roles: Role[] = []): boolean {
  const role = getRoleByName(roleName, roles)
  return role?.isSystem || false
}

// ==================== AUTHENTICATION UTILITIES ====================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: { expiresAt: string }): boolean {
  return new Date() > new Date(session.expiresAt)
}

/**
 * Create a new session
 */
export function createSession(userId: string, durationHours: number = 24) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000)

  return {
    id: generateId(),
    userId,
    token: generateToken(64),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    lastActivity: now.toISOString(),
  }
}

// ==================== LOCAL STORAGE UTILITIES ====================

const STORAGE_KEYS = {
  USERS: "captain-log-users",
  ROLES: "captain-log-roles",
  PERMISSIONS: "captain-log-permissions",
  DEPARTMENTS: "captain-log-departments",
  ACCESS_SCOPES: "captain-log-access-scopes",
  SESSIONS: "captain-log-sessions",
  CURRENT_SESSION: "captain-log-current-session",
  QUESTION_SETS: "captain-log-question-sets",
} as const

/**
 * Save data to localStorage with error handling
 * Only works on client-side; returns silently on server
 */
export function saveToStorage<T>(key: keyof typeof STORAGE_KEYS, data: T): void {
  try {
    if (typeof window === "undefined") return // Server-side, skip
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data))
  } catch (error) {
    console.error(`Failed to save ${key} to storage:`, error)
    // Don't throw on server-side or when localStorage is unavailable
  }
}

/**
 * Load data from localStorage with error handling
 * Only works on client-side; returns default value on server
 */
export function loadFromStorage<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T): T {
  try {
    if (typeof window === "undefined") return defaultValue // Server-side, return default
    const stored = localStorage.getItem(STORAGE_KEYS[key])
    if (!stored) return defaultValue

    const parsed = JSON.parse(stored)
    return Array.isArray(defaultValue) ? parsed : parsed
  } catch (error) {
    console.error(`Failed to load ${key} from storage:`, error)
    return defaultValue
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromStorage(key: keyof typeof STORAGE_KEYS): void {
  try {
    localStorage.removeItem(STORAGE_KEYS[key])
  } catch (error) {
    console.error(`Failed to remove ${key} from storage:`, error)
  }
}

/**
 * Clear all RBAC-related data from storage
 */
export function clearRbacStorage(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Failed to remove ${key} from storage:`, error)
    }
  })
}

// ==================== SECURITY UTILITIES ====================

/**
 * Hash a password (simple implementation for demo)
 * In production, use bcrypt or similar
 */
export async function hashPassword(password: string): Promise<string> {
  // This is a simple hash for demonstration
  // In production, use a proper hashing library
  const cryptoLib = typeof window !== "undefined" ? crypto : require("crypto")

  if (typeof window !== "undefined") {
    // Browser (Web Crypto)
    const encoder = new TextEncoder()
    const data = encoder.encode(password + "salt") // Add salt in production
    const hashBuffer = await cryptoLib.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  } else {
    // Node.js
    const hasher = cryptoLib.createHash("sha256")
    hasher.update(password + "salt") // Add salt in production
    return hasher.digest("hex")
  }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .slice(0, 1000) // Limit length
}

// ==================== AUDIT UTILITIES ====================

/**
 * Create an audit log entry for authentication events
 */
export function createAuthAuditLog(
  action: "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_CHANGE" | "ROLE_CHANGE",
  userId: string,
  details?: Record<string, unknown>
) {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    operation: "AUTH" as const,
    entityId: userId,
    action,
    changes: details,
    metadata: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
    },
  }
}

// ==================== ORGANIZATIONAL STRUCTURE UTILITIES ====================

/**
 * Get all departments from storage
 */
export function getAllDepartments(): Department[] {
  return loadFromStorage("DEPARTMENTS", [] as Department[])
}

/**
 * Save or update a department
 */
export function saveDepartment(department: Department): void {
  const departments = getAllDepartments()
  const existingIndex = departments.findIndex((dept) => dept.id === department.id)

  if (existingIndex >= 0) {
    departments[existingIndex] = department
  } else {
    departments.push(department)
  }

  saveToStorage("DEPARTMENTS", departments)
}

/**
 * Delete department by id
 */
export function deleteDepartment(departmentId: string): void {
  const departments = getAllDepartments().filter((dept) => dept.id !== departmentId)
  saveToStorage("DEPARTMENTS", departments)
}

/**
 * Get all access scopes from storage
 */
export function getAllAccessScopes(): AccessScope[] {
  return loadFromStorage("ACCESS_SCOPES", [] as AccessScope[])
}

/**
 * Save or update an access scope
 */
export function saveAccessScope(scope: AccessScope): void {
  const scopes = getAllAccessScopes()
  const existingIndex = scopes.findIndex((item) => item.id === scope.id)

  if (existingIndex >= 0) {
    scopes[existingIndex] = scope
  } else {
    scopes.push(scope)
  }

  saveToStorage("ACCESS_SCOPES", scopes)
}

/**
 * Delete an access scope
 */
export function deleteAccessScope(scopeId: string): void {
  const scopes = getAllAccessScopes().filter((scope) => scope.id !== scopeId)
  saveToStorage("ACCESS_SCOPES", scopes)
}

/**
 * Initialize default organizational data if storage is empty
 */
export function initializeDefaultOrgStructures(): void {
  const departments = getAllDepartments()
  if (departments.length === 0) {
    saveToStorage("DEPARTMENTS", DEFAULT_DEPARTMENTS)
  }

  const scopes = getAllAccessScopes()
  if (scopes.length === 0) {
    saveToStorage("ACCESS_SCOPES", DEFAULT_ACCESS_SCOPES)
  }
}

// ==================== CUSTOM QUESTION UTILITIES ====================

/**
 * Get question set for a specific role
 */
export function getQuestionSetForRole(roleName: string): RoleQuestionSet | null {
  const questionSets = loadFromStorage("QUESTION_SETS", [] as RoleQuestionSet[])
  return questionSets.find((set) => set.roleName === roleName && set.isActive) || null
}

/**
 * Get all available question sets
 */
export function getAllQuestionSets(): RoleQuestionSet[] {
  return loadFromStorage("QUESTION_SETS", [] as RoleQuestionSet[])
}

/**
 * Save question set to storage
 */
export function saveQuestionSet(questionSet: RoleQuestionSet): void {
  const questionSets = getAllQuestionSets()
  const existingIndex = questionSets.findIndex((set) => set.roleId === questionSet.roleId)

  if (existingIndex >= 0) {
    questionSets[existingIndex] = questionSet
  } else {
    questionSets.push(questionSet)
  }

  saveToStorage("QUESTION_SETS", questionSets)
}

/**
 * Get questions for a user's role
 */
export function getQuestionsForUser(user: User | null): CustomQuestion[] {
  if (!user) return []

  const questionSet = getQuestionSetForRole(user.role)
  return questionSet ? questionSet.questions.sort((a, b) => a.order - b.order) : []
}

/**
 * Validate question response based on question configuration
 * Supports both the legacy CustomQuestion format and the database format with validationRules
 */
export function validateQuestionResponse(question: CustomQuestion | unknown, value: unknown): string | null {
  // Type guard to check if it's a valid question object
  const q = question as Partial<CustomQuestion>
  if (!q || typeof q !== "object") {
    return "Invalid question format"
  }
  // Required field validation
  if (q.required && (value === null || value === undefined || value === "")) {
    return "This field is required"
  }

  // Skip validation for optional empty fields
  if (!q.required && (value === null || value === undefined || value === "")) {
    return null
  }

  // Get validation rules - support both formats:
  // 1. Legacy format: question.validation = { min, max, pattern }
  // 2. Database format: question.validationRules = { min_length, max_length, min_value, max_value, pattern }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validationRules = (q as any).validationRules || q.validation || {}

  // Type-specific validation
  switch (q.type) {
    case "text":
    case "textarea":
    case "email":
    case "url":
    case "phone":
      if (typeof value !== "string") {
        return "Please enter valid text"
      }
      // Check min_length (database format) or min (legacy format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const minLength = (validationRules as any).min_length ?? (validationRules as any).min
      if (minLength !== undefined && minLength !== null && value.length < minLength) {
        return `Minimum ${minLength} character${minLength !== 1 ? "s" : ""} required`
      }
      // Check max_length (database format) or max (legacy format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maxLength = (validationRules as any).max_length ?? (validationRules as any).max
      if (maxLength !== undefined && maxLength !== null && value.length > maxLength) {
        return `Maximum ${maxLength} character${maxLength !== 1 ? "s" : ""} allowed`
      }
      // Check pattern validation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((validationRules as any).pattern) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!new RegExp((validationRules as any).pattern).test(value)) {
            return "Invalid format"
          }
        } catch (e) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.error("Invalid regex pattern:", (validationRules as any).pattern, e)
        }
      }
      break

    case "number":
    case "rating":
      const numValue = Number(value)
      if (isNaN(numValue)) {
        return "Please enter a valid number"
      }
      // Check min_value (database format) or min (legacy format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const minValue = (validationRules as any).min_value ?? (validationRules as any).min
      if (minValue !== undefined && minValue !== null && numValue < minValue) {
        return `Minimum value is ${minValue}`
      }
      // Check max_value (database format) or max (legacy format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maxValue = (validationRules as any).max_value ?? (validationRules as any).max
      if (maxValue !== undefined && maxValue !== null && numValue > maxValue) {
        return `Maximum value is ${maxValue}`
      }
      // Check step validation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((validationRules as any).step !== undefined && (validationRules as any).step !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const step = Number((validationRules as any).step)
        if (!isNaN(step) && step > 0) {
          const remainder = (numValue - (minValue ?? 0)) % step
          if (Math.abs(remainder) > 0.000001) {
            // Use small epsilon for floating point comparison
            return `Value must be in increments of ${step}`
          }
        }
      }
      break

    case "select":
    case "radio":
      if (q.options && !(q.options as string[]).includes(value as string)) {
        return "Please select a valid option"
      }
      break

    case "multiselect":
      if (!Array.isArray(value)) {
        return "Please select at least one option"
      }

      if (q.options && !value.every((v) => (q.options as string[]).includes(v as string))) {
        return "One or more selected options are invalid"
      }
      break

    case "checkbox":
      if (Array.isArray(q.options) && q.options.length > 0) {
        if (!Array.isArray(value) || value.length === 0) {
          return "Please select at least one option"
        }
        if (!value.every((v) => (q.options as string[]).includes(v as string))) {
          return "One or more selected options are invalid"
        }
        break
      }

      if (typeof value !== "boolean") {
        return "Please check or uncheck this field"
      }
      break

    case "date":
    case "datetime":
      if (typeof value !== "string") {
        return "Please enter a valid date"
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return "Please enter a valid date"
      }
      // Check min_date validation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((validationRules as any).min_date) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const minDate = new Date((validationRules as any).min_date)
        if (!isNaN(minDate.getTime()) && date < minDate) {
          return `Date must be on or after ${minDate.toLocaleDateString()}`
        }
      }
      // Check max_date validation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((validationRules as any).max_date) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maxDate = new Date((validationRules as any).max_date)
        if (!isNaN(maxDate.getTime()) && date > maxDate) {
          return `Date must be on or before ${maxDate.toLocaleDateString()}`
        }
      }
      break
  }

  // Custom validation (legacy format only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((q.validation as any)?.custom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (q.validation as any).custom(value)
  }

  return null
}

/**
 * Create a question response object
 */
export function createQuestionResponse(question: CustomQuestion, value: unknown): QuestionResponse {
  return {
    questionId: question.id,
    questionKey: question.key,
    questionLabel: question.label,
    questionType: question.type,
    questionCategory: question.category,
    value,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Process and validate all question responses
 */
export function processQuestionResponses(
  questions: CustomQuestion[],
  responses: Record<string, unknown>
): { valid: boolean; errors: Record<string, string>; processedResponses: QuestionResponse[] } {
  const errors: Record<string, string> = {}
  const processedResponses: QuestionResponse[] = []

  for (const question of questions) {
    const value = responses[question.key]
    const error = validateQuestionResponse(question, value)

    if (error) {
      errors[question.key] = error
    } else {
      processedResponses.push(createQuestionResponse(question, value))
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    processedResponses,
  }
}

/**
 * Initialize default question sets if they don't exist
 */
export function initializeDefaultQuestionSets(): void {
  const existingSets = getAllQuestionSets()

  if (existingSets.length === 0) {
    saveToStorage("QUESTION_SETS", DEFAULT_QUESTION_SETS)
  }
}
