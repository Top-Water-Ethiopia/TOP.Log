/**
 * Phase 1 Tests: Core Architecture (Step IDs + lockedFlow)
 *
 * Tests for:
 * - StepKey type definitions and step ID format
 * - Step type structure
 * - LockedFlow interface
 * - lockedFlow state synchronization
 * - Step derivation from lockedFlow
 */

import { renderHook, waitFor } from "@testing-library/react"
import { useState, useEffect, useMemo } from "react"

// Types from entry-form-multistep.tsx
type StepKey = "date" | `question_${string}` | "preview"

interface Step {
  key: StepKey
  title: string
  number: number
}

interface LockedFlow {
  entryKind: string
  steps: Step[]
  questions: unknown[]
}

// Mock questions for testing
const mockQuestions = [
  { id: "q1", key: "call_outcome", title: "Call Outcome", label: "What was the call outcome?" },
  { id: "q2", key: "notes", title: "Notes", label: "Additional notes" },
  { id: "q3", key: "follow_up", title: "Follow Up", label: "Any follow-up required?" },
]

describe("Phase 1: Core Architecture", () => {
  describe("StepKey Type", () => {
    it("should accept 'date' as valid StepKey", () => {
      const step: Step = { key: "date", title: "Select Date", number: 1 }
      expect(step.key).toBe("date")
    })

    it("should accept 'preview' as valid StepKey", () => {
      const step: Step = { key: "preview", title: "Preview & Submit", number: 5 }
      expect(step.key).toBe("preview")
    })

    it("should accept question_${string} as valid StepKey", () => {
      const step1: Step = { key: "question_call_outcome", title: "Call Outcome", number: 2 }
      const step2: Step = { key: "question_notes", title: "Notes", number: 3 }

      expect(step1.key).toBe("question_call_outcome")
      expect(step2.key).toBe("question_notes")
    })

    it("should maintain unique step keys for each question", () => {
      const keys = mockQuestions.map((q, i) => `question_${q.key}` as StepKey)
      const uniqueKeys = new Set(keys)

      expect(uniqueKeys.size).toBe(keys.length)
    })
  })

  describe("Step Type", () => {
    it("should have required Step properties", () => {
      const step: Step = {
        key: "question_test",
        title: "Test Question",
        number: 3,
      }

      expect(step).toHaveProperty("key")
      expect(step).toHaveProperty("title")
      expect(step).toHaveProperty("number")
      expect(typeof step.number).toBe("number")
    })

    it("should maintain sequential step numbers", () => {
      const steps: Step[] = [
        { key: "date", title: "Select Date", number: 1 },
        { key: "question_q1", title: "Q1", number: 2 },
        { key: "question_q2", title: "Q2", number: 3 },
        { key: "preview", title: "Preview", number: 4 },
      ]

      steps.forEach((step, index) => {
        expect(step.number).toBe(index + 1)
      })
    })
  })

  describe("LockedFlow Interface", () => {
    it("should create valid LockedFlow object", () => {
      const lockedFlow: LockedFlow = {
        entryKind: "agent_call",
        steps: [
          { key: "date", title: "Select Date", number: 1 },
          { key: "question_outcome", title: "Outcome", number: 2 },
          { key: "preview", title: "Preview", number: 3 },
        ],
        questions: mockQuestions,
      }

      expect(lockedFlow.entryKind).toBe("agent_call")
      expect(lockedFlow.steps).toHaveLength(3)
      expect(lockedFlow.questions).toHaveLength(3)
    })

    it("should preserve entryKind in lockedFlow", () => {
      const entryKind = "standard"
      const lockedFlow: LockedFlow = {
        entryKind,
        steps: [{ key: "date", title: "Date", number: 1 }],
        questions: [],
      }

      expect(lockedFlow.entryKind).toBe(entryKind)
    })
  })

  describe("lockedFlow State Synchronization", () => {
    function useLockedFlow(entryKind: string | null, questions: unknown[]) {
      const [lockedFlow, setLockedFlow] = useState<LockedFlow | null>(null)

      useEffect(() => {
        if (!entryKind || lockedFlow) return
        if (questions.length === 0) return

        const lockedSteps: Step[] = [{ key: "date", title: "Select Date", number: 1 }]

        questions.forEach((question: unknown, index: number) => {
          const q = question as { key?: string; title?: string; label?: string }
          const key = String(q.key || `q${index}`)
          const title = String(q.title || q.label || `Question ${index + 1}`)
          lockedSteps.push({
            key: `question_${key}` as StepKey,
            title,
            number: index + 2,
          })
        })

        lockedSteps.push({ key: "preview", title: "Preview & Submit", number: lockedSteps.length + 1 })

        setLockedFlow({
          entryKind,
          steps: lockedSteps,
          questions: questions as unknown[],
        })
      }, [entryKind, questions, lockedFlow])

      return { lockedFlow }
    }

    it("should create lockedFlow when entryKind is set", async () => {
      const { result } = renderHook(() => useLockedFlow("agent_call", mockQuestions))

      await waitFor(() => {
        expect(result.current.lockedFlow).not.toBeNull()
      })

      expect(result.current.lockedFlow?.entryKind).toBe("agent_call")
      expect(result.current.lockedFlow?.steps).toHaveLength(5) // date + 3 questions + preview
    })

    it("should not create lockedFlow without entryKind", async () => {
      const { result } = renderHook(() => useLockedFlow(null, mockQuestions))

      // Wait a bit to ensure effect doesn't run
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(result.current.lockedFlow).toBeNull()
    })

    it("should not recreate lockedFlow if already exists", async () => {
      const { result, rerender } = renderHook(() => useLockedFlow("agent_call", mockQuestions))

      await waitFor(() => {
        expect(result.current.lockedFlow).not.toBeNull()
      })

      const firstLockedFlow = result.current.lockedFlow

      // Rerender with same props
      rerender()

      // Should be the same reference
      expect(result.current.lockedFlow).toBe(firstLockedFlow)
    })

    it("should lock steps with correct question keys", async () => {
      const { result } = renderHook(() => useLockedFlow("standard", mockQuestions))

      await waitFor(() => {
        expect(result.current.lockedFlow).not.toBeNull()
      })

      const steps = result.current.lockedFlow?.steps
      expect(steps?.[0].key).toBe("date")
      expect(steps?.[1].key).toBe("question_call_outcome")
      expect(steps?.[2].key).toBe("question_notes")
      expect(steps?.[3].key).toBe("question_follow_up")
      expect(steps?.[4].key).toBe("preview")
    })
  })

  describe("Step Derivation from lockedFlow", () => {
    it("should use lockedFlow steps when available", () => {
      const lockedFlow: LockedFlow = {
        entryKind: "agent_call",
        steps: [
          { key: "date", title: "Locked Date", number: 1 },
          { key: "question_locked", title: "Locked Q", number: 2 },
          { key: "preview", title: "Locked Preview", number: 3 },
        ],
        questions: [],
      }

      // Simulate the steps memo logic
      const lockedSteps: Step[] | undefined = lockedFlow !== null ? lockedFlow.steps : undefined
      const steps: Step[] = lockedSteps !== undefined ? lockedSteps : []

      expect(steps).toHaveLength(3)
      expect(steps[0].title).toBe("Locked Date")
    })

    it("should fallback to dynamic steps when lockedFlow is null", () => {
      const lockedFlow: LockedFlow | null = null
      const dynamicQuestions = [{ key: "dynamic_q", label: "Dynamic" }]

      // Simulate the fallback logic
      const dynamicSteps: Step[] = dynamicQuestions.map((q, i) => ({
        key: `question-${q.key}` as StepKey,
        title: String(q.label || `Question ${i + 1}`),
        number: i + 2,
      }))

      let steps: Step[]
      if ((lockedFlow as LockedFlow | null) !== null && (lockedFlow as LockedFlow).steps !== undefined) {
        steps = (lockedFlow as LockedFlow).steps
      } else {
        steps = dynamicSteps
      }

      expect(steps).toHaveLength(1)
      expect(steps[0].key).toBe("question-dynamic_q")
    })
  })
})
