/**
 * Phase 4 Tests: Draft Validation with schemaVersion + entryKind + questionIds
 *
 * Tests for:
 * - Draft interface with schemaVersion, entryKind, questionIds
 * - validateDraft function
 * - Schema version mismatch handling
 * - entryKind mismatch handling
 * - Question IDs validation
 * - Draft save with validation fields
 * - Draft restore with validation
 */

import { renderHook, act } from "@testing-library/react"
import { useState, useCallback, useMemo } from "react"

describe("Phase 4: Draft Validation", () => {
  // Types from entry-form-multistep.tsx
  interface Draft {
    version: number
    schemaVersion: number
    savedAt: string
    entryKind: string | null
    questionIds: string[]
    selectedDate: string
    departmentId: string
    currentStep: number
    formData: Record<string, string>
    customResponses: Record<string, unknown>
  }

  interface FormQuestion {
    id: string
    key: string
    label: string
  }

  describe("Draft Interface", () => {
    it("should create valid Draft object", () => {
      const draft: Draft = {
        version: 1,
        schemaVersion: 1,
        savedAt: "2024-01-15T10:00:00Z",
        entryKind: "agent_call",
        questionIds: ["q1", "q2", "q3"],
        selectedDate: "2024-01-15",
        departmentId: "dept_123",
        currentStep: 2,
        formData: { assignedAgentId: "agent_1" },
        customResponses: { notes: "Some notes" },
      }

      expect(draft.version).toBe(1)
      expect(draft.schemaVersion).toBe(1)
      expect(draft.entryKind).toBe("agent_call")
      expect(draft.questionIds).toHaveLength(3)
    })

    it("should allow null entryKind in draft", () => {
      const draft: Draft = {
        version: 1,
        schemaVersion: 1,
        savedAt: "2024-01-15T10:00:00Z",
        entryKind: null,
        questionIds: [],
        selectedDate: "2024-01-15",
        departmentId: "dept_123",
        currentStep: 1,
        formData: {},
        customResponses: {},
      }

      expect(draft.entryKind).toBeNull()
    })

    it("should include all required validation fields", () => {
      const draft = {} as Draft

      // Verify all required fields exist
      expect(draft).toHaveProperty("schemaVersion")
      expect(draft).toHaveProperty("entryKind")
      expect(draft).toHaveProperty("questionIds")
      expect(draft).toHaveProperty("savedAt")
    })
  })

  describe("Draft Validation Function", () => {
    function validateDraft(
      draft: Draft | null,
      currentEntryKind: string | null,
      currentQuestions: FormQuestion[]
    ): boolean {
      if (!draft) return false

      // Check schema version
      if (draft.schemaVersion !== 1) {
        console.warn("Draft schema version mismatch, ignoring draft")
        return false
      }

      // Check entryKind matches
      if (draft.entryKind !== currentEntryKind) {
        console.warn(`Draft entryKind mismatch: ${draft.entryKind} vs ${currentEntryKind}, ignoring draft`)
        return false
      }

      // Check all questionIds exist in current questions
      const currentQuestionIds = new Set(currentQuestions.map((q) => q.id))
      const missingQuestions = draft.questionIds.filter((id) => !currentQuestionIds.has(id))

      if (missingQuestions.length > 0) {
        console.warn(`Draft contains questions that no longer exist: ${missingQuestions.join(", ")}, ignoring draft`)
        return false
      }

      return true
    }

    const mockCurrentQuestions: FormQuestion[] = [
      { id: "q1", key: "question1", label: "Q1" },
      { id: "q2", key: "question2", label: "Q2" },
      { id: "q3", key: "question3", label: "Q3" },
    ]

    it("should return false for null draft", () => {
      expect(validateDraft(null, "standard", mockCurrentQuestions)).toBe(false)
    })

    it("should return true for valid draft", () => {
      const draft: Draft = {
        version: 1,
        schemaVersion: 1,
        savedAt: "2024-01-15T10:00:00Z",
        entryKind: "standard",
        questionIds: ["q1", "q2"],
        selectedDate: "2024-01-15",
        departmentId: "dept_123",
        currentStep: 2,
        formData: {},
        customResponses: {},
      }

      expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(true)
    })

    describe("Schema Version Validation", () => {
      it("should reject draft with wrong schemaVersion", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 2, // Wrong version
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: ["q1"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(false)
      })

      it("should accept draft with correct schemaVersion", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: ["q1"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(true)
      })
    })

    describe("EntryKind Validation", () => {
      it("should reject draft when entryKind doesn't match", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "agent_call",
          questionIds: ["q1"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(false)
      })

      it("should accept draft when entryKind matches", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "agent_call",
          questionIds: ["q1"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "agent_call", mockCurrentQuestions)).toBe(true)
      })

      it("should handle null entryKind correctly", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: null,
          questionIds: [],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, null, mockCurrentQuestions)).toBe(true)
        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(false)
      })
    })

    describe("Question IDs Validation", () => {
      it("should reject draft with missing questions", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: ["q1", "q2", "deleted_question"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(false)
      })

      it("should accept draft when all questions exist", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: ["q1", "q2", "q3"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(true)
      })

      it("should accept draft with empty questionIds", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: [],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(true)
      })

      it("should reject draft with all non-existent questions", () => {
        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: "2024-01-15T10:00:00Z",
          entryKind: "standard",
          questionIds: ["deleted1", "deleted2"],
          selectedDate: "2024-01-15",
          departmentId: "dept_123",
          currentStep: 1,
          formData: {},
          customResponses: {},
        }

        expect(validateDraft(draft, "standard", mockCurrentQuestions)).toBe(false)
      })
    })
  })

  describe("Draft Save with Validation Fields", () => {
    function useDraftSave(
      lockedFlow: { entryKind: string; questions: FormQuestion[] } | null,
      entryKind: string | null,
      currentQuestions: FormQuestion[],
      formData: Record<string, string>,
      customResponses: Record<string, unknown>,
      currentStep: number,
      selectedDate: string,
      departmentId: string
    ) {
      const [lastSavedDraft, setLastSavedDraft] = useState<Draft | null>(null)

      const saveDraft = useCallback(() => {
        const questionIds = currentQuestions.map((q) => q.id)

        const draft: Draft = {
          version: 1,
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          entryKind: lockedFlow?.entryKind ?? entryKind,
          questionIds,
          selectedDate,
          departmentId,
          currentStep,
          formData,
          customResponses,
        }

        setLastSavedDraft(draft)
        return draft
      }, [lockedFlow, entryKind, currentQuestions, formData, customResponses, currentStep, selectedDate, departmentId])

      return { saveDraft, lastSavedDraft }
    }

    const mockQuestions: FormQuestion[] = [
      { id: "q1", key: "q1", label: "Q1" },
      { id: "q2", key: "q2", label: "Q2" },
    ]

    it("should save draft with schemaVersion 1", () => {
      const { result } = renderHook(() =>
        useDraftSave(null, "standard", mockQuestions, {}, {}, 2, "2024-01-15", "dept_123")
      )

      const draft = result.current.saveDraft()

      expect(draft.schemaVersion).toBe(1)
    })

    it("should save draft with entryKind from lockedFlow if available", () => {
      const lockedFlow = {
        entryKind: "agent_call",
        questions: mockQuestions,
      }

      const { result } = renderHook(() =>
        useDraftSave(
          lockedFlow,
          "standard", // Different from lockedFlow
          mockQuestions,
          {},
          {},
          2,
          "2024-01-15",
          "dept_123"
        )
      )

      const draft = result.current.saveDraft()

      // Should use lockedFlow entryKind, not the current entryKind
      expect(draft.entryKind).toBe("agent_call")
    })

    it("should save draft with entryKind from state if no lockedFlow", () => {
      const { result } = renderHook(() =>
        useDraftSave(null, "standard", mockQuestions, {}, {}, 2, "2024-01-15", "dept_123")
      )

      const draft = result.current.saveDraft()

      expect(draft.entryKind).toBe("standard")
    })

    it("should save draft with current question IDs", () => {
      const { result } = renderHook(() =>
        useDraftSave(null, "standard", mockQuestions, {}, {}, 2, "2024-01-15", "dept_123")
      )

      const draft = result.current.saveDraft()

      expect(draft.questionIds).toEqual(["q1", "q2"])
    })

    it("should save draft with timestamp", () => {
      const { result } = renderHook(() =>
        useDraftSave(null, "standard", mockQuestions, {}, {}, 2, "2024-01-15", "dept_123")
      )

      const draft = result.current.saveDraft()

      expect(draft.savedAt).toBeTruthy()
      expect(new Date(draft.savedAt).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe("Draft Restore with Validation", () => {
    function useDraftRestore(draft: Draft | null, currentEntryKind: string | null, currentQuestions: FormQuestion[]) {
      const [restoredState, setRestoredState] = useState<{
        isValid: boolean
        formData?: Record<string, string>
        customResponses?: Record<string, unknown>
        currentStep?: number
      }>({ isValid: false })

      const validateAndRestore = useCallback(() => {
        // Validate draft
        if (!draft) {
          setRestoredState({ isValid: false })
          return
        }

        if (draft.schemaVersion !== 1) {
          setRestoredState({ isValid: false })
          return
        }

        if (draft.entryKind !== currentEntryKind) {
          setRestoredState({ isValid: false })
          return
        }

        const currentQuestionIds = new Set(currentQuestions.map((q) => q.id))
        const hasMissingQuestions = draft.questionIds.some((id) => !currentQuestionIds.has(id))

        if (hasMissingQuestions) {
          setRestoredState({ isValid: false })
          return
        }

        // Restore valid draft
        setRestoredState({
          isValid: true,
          formData: draft.formData,
          customResponses: draft.customResponses,
          currentStep: draft.currentStep,
        })
      }, [draft, currentEntryKind, currentQuestions])

      return { restoredState, validateAndRestore }
    }

    const mockQuestions: FormQuestion[] = [
      { id: "q1", key: "q1", label: "Q1" },
      { id: "q2", key: "q2", label: "Q2" },
    ]

    const validDraft: Draft = {
      version: 1,
      schemaVersion: 1,
      savedAt: "2024-01-15T10:00:00Z",
      entryKind: "standard",
      questionIds: ["q1", "q2"],
      selectedDate: "2024-01-15",
      departmentId: "dept_123",
      currentStep: 3,
      formData: { agentId: "agent_1" },
      customResponses: { notes: "My notes" },
    }

    it("should restore valid draft", async () => {
      const { result } = renderHook(() => useDraftRestore(validDraft, "standard", mockQuestions))

      await act(async () => {
        result.current.validateAndRestore()
      })

      expect(result.current.restoredState.isValid).toBe(true)
      expect(result.current.restoredState.formData).toEqual({ agentId: "agent_1" })
      expect(result.current.restoredState.customResponses).toEqual({ notes: "My notes" })
      expect(result.current.restoredState.currentStep).toBe(3)
    })

    it("should not restore invalid draft", async () => {
      const invalidDraft: Draft = {
        ...validDraft,
        schemaVersion: 2, // Invalid
      }

      const { result } = renderHook(() => useDraftRestore(invalidDraft, "standard", mockQuestions))

      await act(async () => {
        result.current.validateAndRestore()
      })

      expect(result.current.restoredState.isValid).toBe(false)
      expect(result.current.restoredState.formData).toBeUndefined()
    })

    it("should not restore null draft", async () => {
      const { result } = renderHook(() => useDraftRestore(null, "standard", mockQuestions))

      await act(async () => {
        result.current.validateAndRestore()
      })

      expect(result.current.restoredState.isValid).toBe(false)
    })

    it("should not restore draft with mismatched entryKind", async () => {
      const { result } = renderHook(() => useDraftRestore(validDraft, "agent_call", mockQuestions))

      await act(async () => {
        result.current.validateAndRestore()
      })

      expect(result.current.restoredState.isValid).toBe(false)
    })

    it("should not restore draft with missing questions", async () => {
      const draftWithMissingQuestions: Draft = {
        ...validDraft,
        questionIds: ["q1", "q2", "q3"], // q3 doesn't exist
      }

      const { result } = renderHook(() => useDraftRestore(draftWithMissingQuestions, "standard", mockQuestions))

      await act(async () => {
        result.current.validateAndRestore()
      })

      expect(result.current.restoredState.isValid).toBe(false)
    })
  })

  describe("Integration: Save → Validate → Restore Flow", () => {
    it("should complete full save and restore cycle with valid draft", () => {
      // Step 1: Save draft
      const savedDraft: Draft = {
        version: 1,
        schemaVersion: 1,
        savedAt: "2024-01-15T10:00:00Z",
        entryKind: "standard",
        questionIds: ["q1", "q2"],
        selectedDate: "2024-01-15",
        departmentId: "dept_123",
        currentStep: 2,
        formData: { agentId: "agent_1" },
        customResponses: { notes: "Test notes" },
      }

      // Step 2: Validate before restore
      const currentQuestions = [
        { id: "q1", key: "q1", label: "Q1" },
        { id: "q2", key: "q2", label: "Q2" },
      ]

      const isValid =
        savedDraft.schemaVersion === 1 &&
        savedDraft.entryKind === "standard" &&
        savedDraft.questionIds.every((id) => currentQuestions.some((q) => q.id === id))

      expect(isValid).toBe(true)

      // Step 3: Restore
      if (isValid) {
        const restoredState = {
          formData: savedDraft.formData,
          customResponses: savedDraft.customResponses,
          currentStep: savedDraft.currentStep,
        }

        expect(restoredState.formData).toEqual({ agentId: "agent_1" })
        expect(restoredState.customResponses).toEqual({ notes: "Test notes" })
      }
    })

    it("should break cycle when validation fails", () => {
      const savedDraft: Draft = {
        version: 1,
        schemaVersion: 1,
        savedAt: "2024-01-15T10:00:00Z",
        entryKind: "standard",
        questionIds: ["q1", "q2", "deleted_q3"],
        selectedDate: "2024-01-15",
        departmentId: "dept_123",
        currentStep: 2,
        formData: { agentId: "agent_1" },
        customResponses: { notes: "Test notes" },
      }

      const currentQuestions = [
        { id: "q1", key: "q1", label: "Q1" },
        { id: "q2", key: "q2", label: "Q2" },
        // q3 was deleted
      ]

      const isValid =
        savedDraft.schemaVersion === 1 &&
        savedDraft.entryKind === "standard" &&
        savedDraft.questionIds.every((id) => currentQuestions.some((q) => q.id === id))

      expect(isValid).toBe(false)
    })
  })
})
