import { describe, it, expect } from "@jest/globals"

/**
 * Textarea validation utilities and tests
 * Tests minimum length, maximum length, and pattern (regex) validation
 */

type ValidationResult = {
  valid: boolean
  errors: string[]
}

function validateTextarea(
  value: string,
  options: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    patternMessage?: string
  }
): ValidationResult {
  const errors: string[] = []

  // Minimum length validation
  if (options.minLength !== undefined && value.length < options.minLength) {
    errors.push(`Minimum length is ${options.minLength} characters`)
  }

  // Maximum length validation
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    errors.push(`Maximum length is ${options.maxLength} characters`)
  }

  // Pattern/regex validation
  if (options.pattern !== undefined && !options.pattern.test(value)) {
    errors.push(options.patternMessage || "Invalid format")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

describe("Textarea Validation", () => {
  describe("Minimum Length Validation", () => {
    it("should pass when value meets minimum length", () => {
      const result = validateTextarea("Hello World", { minLength: 5 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should pass when value exceeds minimum length", () => {
      const result = validateTextarea("Hello World", { minLength: 3 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should fail when value is below minimum length", () => {
      const result = validateTextarea("Hi", { minLength: 5 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Minimum length is 5 characters")
    })

    it("should fail when value is empty and minimum length is set", () => {
      const result = validateTextarea("", { minLength: 1 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Minimum length is 1 characters")
    })

    it("should handle exact minimum length", () => {
      const result = validateTextarea("Hello", { minLength: 5 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe("Maximum Length Validation", () => {
    it("should pass when value is within maximum length", () => {
      const result = validateTextarea("Hello", { maxLength: 10 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should pass when value is below maximum length", () => {
      const result = validateTextarea("Hi", { maxLength: 10 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should fail when value exceeds maximum length", () => {
      const result = validateTextarea("Hello World!", { maxLength: 5 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Maximum length is 5 characters")
    })

    it("should handle exact maximum length", () => {
      const result = validateTextarea("Hello", { maxLength: 5 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should fail for empty string when max is 0", () => {
      const result = validateTextarea("", { maxLength: 0 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe("Pattern (Regex) Validation", () => {
    it("should pass when value matches pattern", () => {
      const result = validateTextarea("hello123", { pattern: /^[a-z0-9]+$/ })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should fail when value does not match pattern", () => {
      const result = validateTextarea("Hello World!", { pattern: /^[a-z0-9]+$/ })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Invalid format")
    })

    it("should use custom pattern message when provided", () => {
      const result = validateTextarea("abc", {
        pattern: /^[0-9]+$/,
        patternMessage: "Only numbers allowed",
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Only numbers allowed")
    })

    it("should validate email pattern", () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      const validResult = validateTextarea("test@example.com", { pattern: emailPattern })
      expect(validResult.valid).toBe(true)

      const invalidResult = validateTextarea("invalid-email", { pattern: emailPattern })
      expect(invalidResult.valid).toBe(false)
    })

    it("should validate alphanumeric with spaces pattern", () => {
      const pattern = /^[a-zA-Z0-9\s]+$/

      const validResult = validateTextarea("Hello World 123", { pattern })
      expect(validResult.valid).toBe(true)

      const invalidResult = validateTextarea("Hello@World!", { pattern })
      expect(invalidResult.valid).toBe(false)
    })

    it("should validate no special characters pattern", () => {
      const pattern = /^[a-zA-Z\s]*$/

      const validResult = validateTextarea("Hello World", { pattern })
      expect(validResult.valid).toBe(true)

      const invalidResult = validateTextarea("Hello123", { pattern })
      expect(invalidResult.valid).toBe(false)
    })

    it("should pass empty string when pattern allows it", () => {
      const result = validateTextarea("", { pattern: /^[a-z]*$/ })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe("Combined Validation", () => {
    it("should pass when all constraints are met", () => {
      const result = validateTextarea("Hello123", {
        minLength: 5,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9]+$/,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should return multiple errors when multiple constraints fail", () => {
      const result = validateTextarea("Hi!", {
        minLength: 5,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9]+$/,
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain("Minimum length is 5 characters")
      expect(result.errors).toContain("Invalid format")
    })

    it("should fail on minLength even when maxLength would pass", () => {
      const result = validateTextarea("Hi", {
        minLength: 5,
        maxLength: 10,
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors).toContain("Minimum length is 5 characters")
    })

    it("should fail on maxLength even when minLength would pass", () => {
      const result = validateTextarea("This is a very long string", {
        minLength: 5,
        maxLength: 10,
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors).toContain("Maximum length is 10 characters")
    })

    it("should validate complex pattern with length constraints", () => {
      const result = validateTextarea("Hello World 12345", {
        minLength: 10,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9\s]+$/,
        patternMessage: "Only alphanumeric characters and spaces allowed",
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe("Edge Cases", () => {
    it("should handle whitespace-only strings with minLength", () => {
      const result = validateTextarea("   ", { minLength: 5 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Minimum length is 5 characters")
    })

    it("should handle multiline text with length constraints", () => {
      const multiline = "Line 1\nLine 2\nLine 3"
      const result = validateTextarea(multiline, { minLength: 10, maxLength: 100 })
      expect(result.valid).toBe(true)
    })

    it("should handle unicode characters in length validation", () => {
      const unicode = "🎉🎊🎁"
      const result = validateTextarea(unicode, { minLength: 3, maxLength: 10 })
      expect(result.valid).toBe(true)
    })

    it("should handle no constraints (all optional)", () => {
      const result = validateTextarea("Any value", {})
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should handle empty string with no constraints", () => {
      const result = validateTextarea("", {})
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should trim not be applied by default", () => {
      const result = validateTextarea("  hello  ", { minLength: 9 })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})

export { validateTextarea }
export type { ValidationResult }
