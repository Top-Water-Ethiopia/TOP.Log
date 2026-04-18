import {
  validatePassword,
  checkPasswordRequirements,
  calculateStrength,
  changePasswordErrorMessages,
  type ChangePasswordError,
} from "@/lib/auth/password"

describe("password validation utilities", () => {
  describe("checkPasswordRequirements", () => {
    it("checks all requirements correctly", () => {
      const weak = checkPasswordRequirements("abc")
      expect(weak.minLength).toBe(false)
      expect(weak.hasUppercase).toBe(false)
      expect(weak.hasLowercase).toBe(true)
      expect(weak.hasNumber).toBe(false)
      expect(weak.hasSpecial).toBe(false)

      const strong = checkPasswordRequirements("Hello1!")
      expect(strong.minLength).toBe(false) // only 7 chars
      expect(strong.hasUppercase).toBe(true)
      expect(strong.hasLowercase).toBe(true)
      expect(strong.hasNumber).toBe(true)
      expect(strong.hasSpecial).toBe(true)

      const valid = checkPasswordRequirements("HelloWorld1!")
      expect(valid.minLength).toBe(true)
      expect(valid.hasUppercase).toBe(true)
      expect(valid.hasLowercase).toBe(true)
      expect(valid.hasNumber).toBe(true)
      expect(valid.hasSpecial).toBe(true)
    })
  })

  describe("calculateStrength", () => {
    it("returns weak for passwords meeting 2 or fewer requirements", () => {
      expect(calculateStrength("abc")).toBe("weak")
      expect(calculateStrength("abc123")).toBe("weak")
    })

    it("returns fair for passwords meeting 3-4 requirements", () => {
      expect(calculateStrength("Abc123")).toBe("fair") // upper, lower, number
      expect(calculateStrength("Abc123!")).toBe("fair") // 7 chars, all types
    })

    it("returns strong for passwords meeting all 5 requirements", () => {
      expect(calculateStrength("HelloWorld1!")).toBe("strong")
      expect(calculateStrength("MyP@ssw0rd")).toBe("strong")
    })
  })

  describe("validatePassword", () => {
    it("returns isValid false for weak passwords", () => {
      const result = validatePassword("abc")
      expect(result.isValid).toBe(false)
      expect(result.strength).toBe("weak")
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("returns isValid true for strong passwords", () => {
      const result = validatePassword("HelloWorld1!")
      expect(result.isValid).toBe(true)
      expect(result.strength).toBe("strong")
      expect(result.errors).toHaveLength(0)
    })

    it("returns appropriate errors for missing requirements", () => {
      const noUpper = validatePassword("helloworld1!")
      expect(noUpper.errors).toContain("Password must contain an uppercase letter")

      const noLower = validatePassword("HELLOWORLD1!")
      expect(noLower.errors).toContain("Password must contain a lowercase letter")

      const noNumber = validatePassword("HelloWorld!")
      expect(noNumber.errors).toContain("Password must contain a number")

      const noSpecial = validatePassword("HelloWorld1")
      expect(noSpecial.errors).toContain("Password must contain a special character")

      const tooShort = validatePassword("Hi1!")
      expect(tooShort.errors).toContain("Password must be at least 8 characters")
    })

    it("returns requirements object with validation result", () => {
      const result = validatePassword("HelloWorld1!")
      expect(result.requirements).toEqual({
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true,
        hasSpecial: true,
      })
    })
  })

  describe("changePasswordErrorMessages", () => {
    it("has user-friendly messages for all error types", () => {
      const errors: ChangePasswordError[] = [
        "INVALID_CURRENT_PASSWORD",
        "WEAK_PASSWORD",
        "PASSWORD_REUSE",
        "CONFIRM_MISMATCH",
        "NETWORK_ERROR",
        "UNKNOWN_ERROR",
      ]

      errors.forEach((error) => {
        expect(changePasswordErrorMessages[error]).toBeDefined()
        expect(changePasswordErrorMessages[error].length).toBeGreaterThan(0)
      })
    })

    it("returns appropriate messages for specific errors", () => {
      expect(changePasswordErrorMessages.INVALID_CURRENT_PASSWORD).toBe(
        "Current password is incorrect"
      )
      expect(changePasswordErrorMessages.PASSWORD_REUSE).toBe(
        "New password must differ from current password"
      )
      expect(changePasswordErrorMessages.CONFIRM_MISMATCH).toBe("Passwords do not match")
    })
  })
})
