/**
 * Password validation utilities for auth flows
 */

export type PasswordStrength = 'weak' | 'fair' | 'strong'

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

export interface PasswordValidationResult {
  isValid: boolean
  strength: PasswordStrength
  errors: string[]
  requirements: PasswordRequirements
}

const MIN_LENGTH = 8

/**
 * Check individual password requirements
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }
}

/**
 * Calculate password strength based on requirements met
 */
export function calculateStrength(password: string): PasswordStrength {
  const reqs = checkPasswordRequirements(password)
  const met = Object.values(reqs).filter(Boolean).length

  if (met <= 2) return 'weak'
  if (met <= 4) return 'fair'
  return 'strong'
}

/**
 * Validate password against policy
 */
export function validatePassword(password: string): PasswordValidationResult {
  const requirements = checkPasswordRequirements(password)
  const errors: string[] = []

  if (!requirements.minLength) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`)
  }
  if (!requirements.hasUppercase) {
    errors.push('Password must contain an uppercase letter')
  }
  if (!requirements.hasLowercase) {
    errors.push('Password must contain a lowercase letter')
  }
  if (!requirements.hasNumber) {
    errors.push('Password must contain a number')
  }
  if (!requirements.hasSpecial) {
    errors.push('Password must contain a special character')
  }

  const isValid = errors.length === 0
  const strength = calculateStrength(password)

  return {
    isValid,
    strength,
    errors,
    requirements,
  }
}

/**
 * Change password error types
 */
export type ChangePasswordError =
  | 'INVALID_CURRENT_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'PASSWORD_REUSE'
  | 'CONFIRM_MISMATCH'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'

export interface ChangePasswordResult {
  success: boolean
  error?: ChangePasswordError
  message?: string
}

/**
 * User-friendly error messages
 */
export const changePasswordErrorMessages: Record<ChangePasswordError, string> = {
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect',
  WEAK_PASSWORD: 'Password does not meet requirements',
  PASSWORD_REUSE: 'New password must differ from current password',
  CONFIRM_MISMATCH: 'Passwords do not match',
  NETWORK_ERROR: 'Network error. Please try again.',
  UNKNOWN_ERROR: 'An error occurred. Please try again.',
}
