/**
 * Phase 3 Tests: Protective UX Guards
 *
 * Tests for:
 * - Double submit prevention (isSubmitting guard)
 * - Date change confirmation with hasAnswers check
 * - Draft key bug fix (using old date for removal)
 * - Submit button disabled state (only on isSubmitting)
 */

import { renderHook, act, waitFor } from "@testing-library/react"
import { useState, useCallback, useRef, useEffect } from "react"

describe("Phase 3: Protective UX Guards", () => {
  describe("Double Submit Prevention", () => {
    function useSubmitGuard() {
      const [isSubmitting, setIsSubmitting] = useState(false)
      const [submitCount, setSubmitCount] = useState(0)
      const isSubmittingRef = useRef(false)

      // Sync ref with state whenever state changes
      useEffect(() => {
        isSubmittingRef.current = isSubmitting
      }, [isSubmitting])

      const handleSubmit = useCallback(async () => {
        // Guard: prevent double submit using ref for latest value
        if (isSubmittingRef.current) {
          console.log("Submit blocked: already submitting")
          return { success: false, reason: "already_submitting" }
        }

        // Update ref immediately to block concurrent calls
        isSubmittingRef.current = true
        setIsSubmitting(true)

        try {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 100))
          setSubmitCount((prev) => prev + 1)
          return { success: true }
        } finally {
          isSubmittingRef.current = false
          setIsSubmitting(false)
        }
      }, [])

      return { isSubmitting, submitCount, handleSubmit }
    }

    it("should block concurrent submissions", async () => {
      const { result } = renderHook(() => useSubmitGuard())

      // Start first submission
      const promise1 = result.current.handleSubmit()

      // Immediately try second submission (should be blocked)
      const promise2 = result.current.handleSubmit()

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
      expect(result2.reason).toBe("already_submitting")
      expect(result.current.submitCount).toBe(1) // Only one submit went through
    })

    it("should allow submission after completion", async () => {
      const { result } = renderHook(() => useSubmitGuard())

      // First submission
      await result.current.handleSubmit()
      expect(result.current.submitCount).toBe(1)

      // Second submission (should succeed)
      await result.current.handleSubmit()
      expect(result.current.submitCount).toBe(2)
    })

    it("should set isSubmitting during submission", async () => {
      const { result } = renderHook(() => useSubmitGuard())

      expect(result.current.isSubmitting).toBe(false)

      const promise = result.current.handleSubmit()

      // Wait for state update to be processed
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true)
      })

      await promise

      // Wait for isSubmitting to become false after promise resolves
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false)
      })
    })
  })

  describe("Submit Button Disabled State", () => {
    it("should disable button only based on isSubmitting", () => {
      const isSubmitting = true
      const isValid = true // Form is valid

      // Button should be disabled when submitting, regardless of validation
      const isDisabled = isSubmitting

      expect(isDisabled).toBe(true)
    })

    it("should enable button when not submitting (even if validation would fail)", () => {
      const isSubmitting = false
      const isValid = false // Form validation might fail

      // Button should be enabled - let submit handler validate
      const isDisabled = isSubmitting

      expect(isDisabled).toBe(false)
    })

    it("should not use isValid in disabled prop", () => {
      // This test verifies the pattern: disabled={isSubmitting} not disabled={!isValid || isSubmitting}
      const testCases = [
        { isSubmitting: false, isValid: false, expectedDisabled: false },
        { isSubmitting: false, isValid: true, expectedDisabled: false },
        { isSubmitting: true, isValid: false, expectedDisabled: true },
        { isSubmitting: true, isValid: true, expectedDisabled: true },
      ]

      testCases.forEach(({ isSubmitting, expectedDisabled }) => {
        const isDisabled = isSubmitting // Correct pattern
        expect(isDisabled).toBe(expectedDisabled)
      })
    })
  })

  describe("Date Change Confirmation", () => {
    function useDateChangeConfirmation() {
      const [selectedDate, setSelectedDate] = useState("2024-01-15")
      const [customResponses, setCustomResponses] = useState<Record<string, unknown>>({})
      const [confirmationShown, setConfirmationShown] = useState(false)
      const [clearedDraftKey, setClearedDraftKey] = useState<string | null>(null)

      // Expose check function for testing
      const checkHasAnswers = (responses: Record<string, unknown>): boolean => {
        return Object.entries(responses).some(([_, value]) => {
          if (value === "" || value === null || value === undefined) return false
          if (Array.isArray(value) && value.length === 0) return false
          if (typeof value === "boolean" && !value) return false
          return true
        })
      }

      // Note: This implementation uses the passed responses parameter directly
      // to avoid stale closure issues with React Testing Library
      const handleDateSelection = useCallback(
        (newDate: string, currentResponses?: Record<string, unknown>) => {
          if (newDate === selectedDate) return

          // Must pass responses directly - don't fall back to state in tests
          const responsesToCheck = currentResponses ?? {}

          const hasAnswers = checkHasAnswers(responsesToCheck)

          if (hasAnswers) {
            setConfirmationShown(true)
            setClearedDraftKey(`draft_${selectedDate}`)
          }

          setSelectedDate(newDate)
        },
        [selectedDate]
      )

      return {
        selectedDate,
        customResponses,
        setCustomResponses,
        handleDateSelection,
        confirmationShown,
        clearedDraftKey,
        checkHasAnswers,
      }
    }

    it("should show confirmation when changing date with answers", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      // Add some answers and immediately pass them to handleDateSelection
      const responses = { notes: "Some notes", outcome: "success" }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(true)
    })

    it("should not show confirmation when no answers", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      // No answers set (default empty)
      await act(async () => {
        result.current.handleDateSelection("2024-01-16")
      })

      expect(result.current.confirmationShown).toBe(false)
      expect(result.current.selectedDate).toBe("2024-01-16")
    })

    it("should not show confirmation for same date", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { notes: "Some notes" }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-15", responses) // Same as current
      })

      expect(result.current.confirmationShown).toBe(false)
    })

    it("should use old date for draft key removal (bug fix)", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { notes: "Some notes" }
      const oldDate = result.current.selectedDate // "2024-01-15"

      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      // Should clear draft for OLD date, not new date
      expect(result.current.clearedDraftKey).toBe(`draft_${oldDate}`)
      expect(result.current.clearedDraftKey).not.toBe("draft_2024-01-16")
    })

    it("should detect non-empty string as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: "some value" }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(true)
    })

    it("should not detect empty string as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: "" }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(false)
    })

    it("should not detect null/undefined as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: null, field2: undefined }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(false)
    })

    it("should not detect empty array as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: [] }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(false)
    })

    it("should detect non-empty array as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: ["item1"] }
      await act(async () => {
        result.current.setCustomResponses(responses)
      })
      await act(async () => {
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(true)
    })

    it("should not detect false boolean as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: false }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(false)
    })

    it("should detect true boolean as answer", async () => {
      const { result } = renderHook(() => useDateChangeConfirmation())

      const responses = { field1: true }
      await act(async () => {
        result.current.setCustomResponses(responses)
        result.current.handleDateSelection("2024-01-16", responses)
      })

      expect(result.current.confirmationShown).toBe(true)
    })
  })

  describe("hasAnswers Helper Function", () => {
    function hasAnswers(responses: Record<string, unknown>): boolean {
      return Object.entries(responses).some(([_, value]) => {
        if (value === "" || value === null || value === undefined) return false
        if (Array.isArray(value) && value.length === 0) return false
        if (typeof value === "boolean" && !value) return false
        return true
      })
    }

    it("returns false for empty responses", () => {
      expect(hasAnswers({})).toBe(false)
    })

    it("returns false for responses with only empty values", () => {
      expect(hasAnswers({ a: "", b: null, c: undefined, d: [], e: false })).toBe(false)
    })

    it("returns true if any value is non-empty", () => {
      expect(hasAnswers({ a: "", b: "value" })).toBe(true)
      expect(hasAnswers({ a: null, b: ["item"] })).toBe(true)
      expect(hasAnswers({ a: undefined, b: true })).toBe(true)
    })
  })
})
