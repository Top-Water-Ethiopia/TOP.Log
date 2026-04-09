import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import {
  RoleQuestionsCreator,
  buildQuestionScopeFields,
  filterQuestionsForEntryKind,
  questionTypeSupportsStaticOptions,
  removeQuestionFromList,
  sanitizeQuestionsForScope,
} from "@/components/role-questions-creator"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useScopeEntryKinds } from "@/hooks/use-entry-kinds"

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: jest.fn(),
}))

jest.mock("@/hooks/use-entry-kinds", () => ({
  useScopeEntryKinds: jest.fn(),
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe("RoleQuestionsCreator", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useSupabaseAuth as jest.Mock).mockReturnValue({
      user: { id: "user-1" },
      profile: { id: "profile-1", role_id: "admin-role" },
      isLoading: false,
    })
    ;(useScopeEntryKinds as jest.Mock).mockReturnValue({
      entryKinds: [],
      isLoading: true,
      error: null,
      mutate: jest.fn(),
    })

    // Default mock implementation
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/admin/departments") && !url.includes("profession-roles")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: "dept-1", name: "Marketing" }] }),
        })
      }
      if (url.includes("profession-roles")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: "role-uuid-1", key: "sales-promoter", label: "Sales Promoter", is_active: true },
            ],
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      })
    })
  })

  it("handles 'roleId' parameter and sets scope to 'role'", async () => {
    const mockSearchParams = new URLSearchParams({
      departmentId: "dept-1",
      roleId: "sales-promoter",
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    render(<RoleQuestionsCreator />)

    await waitFor(() => {
      // It should call useScopeEntryKinds with the profession KEY
      expect(useScopeEntryKinds).toHaveBeenCalledWith("dept-1", "sales-promoter")
    })
  })

  it("handles 'role' parameter as an alias for 'roleId'", async () => {
    const mockSearchParams = new URLSearchParams({
      departmentId: "dept-1",
      role: "sales-promoter",
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    render(<RoleQuestionsCreator />)

    await waitFor(() => {
      // It should call useScopeEntryKinds with the profession KEY
      expect(useScopeEntryKinds).toHaveBeenCalledWith("dept-1", "sales-promoter")
    })
  })

  it("sets scope to 'role' even if scope=department is passed but roleId is present", async () => {
    const mockSearchParams = new URLSearchParams({
      scope: "department",
      departmentId: "dept-1",
      roleId: "sales-promoter",
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    render(<RoleQuestionsCreator />)

    await waitFor(() => {
      expect(useScopeEntryKinds).toHaveBeenCalledWith("dept-1", "sales-promoter")
    })
  })

  it("does not refetch existing scope questions when local tab state changes", async () => {
    const mockSearchParams = new URLSearchParams({
      scope: "role",
      departmentId: "dept-1",
      roleId: "sales-promoter",
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
    ;(useScopeEntryKinds as jest.Mock).mockReturnValue({
      entryKinds: [
        {
          id: "kind-1",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "standard",
          label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
      ],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    })

    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/admin/departments") && !url.includes("profession-roles")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: "dept-1", name: "Marketing" }] }),
        })
      }
      if (url.includes("profession-roles")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: "role-uuid-1", key: "sales-promoter", label: "Sales Promoter", is_active: true },
            ],
          }),
        })
      }
      if (url === "/api/role-questions") {
        return Promise.resolve({
          ok: true,
          json: async () => ([]),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      })
    })

    render(<RoleQuestionsCreator />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/role-questions",
        expect.objectContaining({ credentials: "include" })
      )
    })

    await waitFor(() => {
      const roleQuestionCalls = mockFetch.mock.calls.filter(([url]) => url === "/api/role-questions")
      expect(roleQuestionCalls).toHaveLength(1)
    })
  })

  it("builds profession-scoped payload fields using the profession id and role key", () => {
    const scopeFields = buildQuestionScopeFields(
      "role",
      null,
      { id: "dept-1", name: "Marketing", description: null },
      {
        id: "role-uuid-1",
        key: "sales-promoter",
        label: "Sales Promoter",
        sort_order: 0,
        is_active: true,
        is_default: false,
      }
    )

    expect(scopeFields).toEqual({
      department_id: "dept-1",
      department_profession_id: "role-uuid-1",
      department_role: "sales-promoter",
    })
  })

  it("treats checkbox questions as supporting static options", () => {
    expect(questionTypeSupportsStaticOptions("checkbox")).toBe(true)
    expect(questionTypeSupportsStaticOptions("select")).toBe(true)
    expect(questionTypeSupportsStaticOptions("textarea")).toBe(false)
  })

  it("removes deleted questions from the list and reindexes display order", () => {
    const remaining = removeQuestionFromList(
      [
        {
          id: "question-1",
          question_key: "one",
          question_label: "One",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 0,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          max_logs_per_agent_per_day: null,
          entry_kind: "standard",
        },
        {
          id: "question-2",
          question_key: "two",
          question_label: "",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 1,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          max_logs_per_agent_per_day: null,
          entry_kind: "standard",
        },
      ],
      "question-2"
    )

    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe("question-1")
    expect(remaining[0].display_order).toBe(0)
  })

  it("filters visible questions by active entry kind without counting hidden tabs", () => {
    const visible = filterQuestionsForEntryKind(
      [
        {
          id: "question-1",
          question_key: "one",
          question_label: "One",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 0,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          max_logs_per_agent_per_day: null,
          entry_kind: "standard",
        },
        {
          id: "question-2",
          question_key: "two",
          question_label: "Two",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 1,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          max_logs_per_agent_per_day: null,
          entry_kind: "majoractivities",
        },
      ],
      "majoractivities"
    )

    expect(visible).toHaveLength(1)
    expect(visible[0].id).toBe("question-2")
  })

  it("drops stale questions whose entry kind is no longer configured for the scope", () => {
    const result = sanitizeQuestionsForScope(
      [
        {
          id: "stale-question",
          question_key: "agent_name",
          question_label: "Agent Name",
          question_type: "select",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: true,
          display_order: 0,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "assigned_agents",
          entry_kind: "agent_call",
        },
      ],
      [
        {
          id: "kind-1",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "standard",
          label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
        {
          id: "kind-2",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "majoractivities",
          label: "Major Activities",
          description: null,
          sort_order: 1,
          is_default: false,
          is_active: true,
          supports_assigned_agent: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
      ],
      "standard",
      "agent_call"
    )

    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].entry_kind).toBe("standard")
    expect(result.activeEntryKindTab).toBe("standard")
  })

  it("resets an invalid active tab to the current default active entry kind", () => {
    const result = sanitizeQuestionsForScope(
      [
        {
          id: "majoractivities-question",
          question_key: "major_activities",
          question_label: "Major Activities",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 0,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          entry_kind: "majoractivities",
        },
      ],
      [
        {
          id: "kind-1",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "standard",
          label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
      ],
      "standard",
      "agent_call"
    )

    expect(result.questions[0].entry_kind).toBe("standard")
    expect(result.activeEntryKindTab).toBe("standard")
  })

  it("preserves a valid active tab even when existing questions are in another configured entry kind", () => {
    const result = sanitizeQuestionsForScope(
      [
        {
          id: "standard-question",
          question_key: "daily_notes",
          question_label: "Daily Notes",
          question_type: "textarea",
          question_description: "",
          placeholder: "",
          options: null,
          is_required: false,
          display_order: 0,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          pattern: "",
          step: null,
          min_date: "",
          max_date: "",
          is_active: true,
          option_source_kind: "static",
          entry_kind: "standard",
        },
      ],
      [
        {
          id: "kind-1",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "standard",
          label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
        {
          id: "kind-2",
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "majoractivities",
          label: "Major Activities",
          description: null,
          sort_order: 1,
          is_default: false,
          is_active: true,
          supports_assigned_agent: false,
          color: null,
          icon: null,
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
      ],
      "standard",
      "majoractivities"
    )

    expect(result.questions[0].entry_kind).toBe("standard")
    expect(result.activeEntryKindTab).toBe("majoractivities")
  })
})
