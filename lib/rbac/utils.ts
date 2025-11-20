"use client"

import type { User, Role, Permission, Session, CustomQuestion, RoleQuestionSet, QuestionResponse, PermissionCheck, RoleHierarchy, Department, AccessScope } from "./types"
import { DEFAULT_QUESTION_SETS, DEFAULT_DEPARTMENTS, DEFAULT_ACCESS_SCOPES } from "./types"

// ==================== PERMISSION CHECKING UTILITIES ====================

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  user: User | null,
  permission: string,
  roles: Role[] = []
): boolean {
  if (!user || !user.isActive) return false

  const userRole = roles.find(role => role.name === user.role)
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
export function hasRoleLevel(
  user: User | null,
  requiredLevel: number,
  roleHierarchy: RoleHierarchy
): boolean {
  if (!user || !user.isActive) return false

  const userLevel = roleHierarchy[user.role] || 0
  return userLevel >= requiredLevel
}

/**
 * Check if a user can manage another user (role hierarchy based)
 */
export function canManageUser(
  manager: User | null,
  targetUser: User | null,
  roleHierarchy: RoleHierarchy
): boolean {
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

  const userRole = roles.find(role => role.name === user.role)
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
    return resources.filter(resource => resource.userId === user.id)
  }

  return []
}

// ==================== ROLE MANAGEMENT UTILITIES ====================

/**
 * Get role by name
 */
export function getRoleByName(roleName: string, roles: Role[] = []): Role | undefined {
  return roles.find(role => role.name === roleName)
}

/**
 * Get roles that a user can assign to others (based on hierarchy)
 */
export function getAssignableRoles(
  user: User | null,
  allRoles: Role[] = [],
  roleHierarchy: RoleHierarchy
): Role[] {
  if (!user) return []

  const userLevel = roleHierarchy[user.role] || 0
  return allRoles.filter(role => role.level < userLevel)
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
  Object.values(STORAGE_KEYS).forEach(key => {
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
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "salt") // Add salt in production
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
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
  return questionSets.find(set => set.roleName === roleName && set.isActive) || null
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
  const existingIndex = questionSets.findIndex(set => set.roleId === questionSet.roleId)
  
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
 */
export function validateQuestionResponse(question: CustomQuestion, value: any): string | null {
  // Required field validation
  if (question.required && (value === null || value === undefined || value === "")) {
    return `${question.label} is required`
  }
  
  // Skip validation for optional empty fields
  if (!question.required && (value === null || value === undefined || value === "")) {
    return null
  }
  
  // Type-specific validation
  switch (question.type) {
    case "text":
    case "textarea":
      if (typeof value !== "string") {
        return `${question.label} must be text`
      }
      if (question.validation?.min && value.length < question.validation.min) {
        return `${question.label} must be at least ${question.validation.min} characters`
      }
      if (question.validation?.max && value.length > question.validation.max) {
        return `${question.label} must not exceed ${question.validation.max} characters`
      }
      if (question.validation?.pattern && !new RegExp(question.validation.pattern).test(value)) {
        return `${question.label} format is invalid`
      }
      break
      
    case "number":
      const numValue = Number(value)
      if (isNaN(numValue)) {
        return `${question.label} must be a number`
      }
      if (question.validation?.min !== undefined && numValue < question.validation.min) {
        return `${question.label} must be at least ${question.validation.min}`
      }
      if (question.validation?.max !== undefined && numValue > question.validation.max) {
        return `${question.label} must not exceed ${question.validation.max}`
      }
      break
      
    case "select":
      if (question.options && !question.options.includes(value)) {
        return `${question.label} must be one of the predefined options`
      }
      break
      
    case "multiselect":
      if (!Array.isArray(value)) {
        return `${question.label} must be an array of values`
      }
      if (question.options && !value.every(v => question.options!.includes(v))) {
        return `${question.label} contains invalid options`
      }
      break
      
    case "checkbox":
      if (typeof value !== "boolean") {
        return `${question.label} must be true or false`
      }
      break
      
    case "date":
      if (typeof value !== "string") {
        return `${question.label} must be a date string`
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return `${question.label} must be a valid date`
      }
      break
  }
  
  // Custom validation
  if (question.validation?.custom) {
    return question.validation.custom(value)
  }
  
  return null
}

/**
 * Create a question response object
 */
export function createQuestionResponse(
  question: CustomQuestion,
  value: any
): QuestionResponse {
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
  responses: Record<string, any>
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
