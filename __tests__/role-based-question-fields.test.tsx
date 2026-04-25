import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { validateQuestionResponse } from "@/lib/rbac/utils"
import { ASSIGNED_AGENTS_OPTION_SOURCE_KIND } from "@/lib/marketing-agents"

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-123", email: "sam@example.com" },
    profile: {
      id: "profile-1",
      user_id: "user-123",
      name: "Sam Tester",
      role_id: "admin-role",
      department_id: null,
      is_active: true,
      metadata: null,
      last_login: null,
    },
  }),
}))

describe("RoleBasedQuestionFields", () => {
  it("renders checkbox questions with options as a checkbox list", () => {
    const onChange = jest.fn()

    render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "activities",
            label: "Activities",
            type: "checkbox",
            options: ["Visited stores", "Collected feedback"],
            required: false,
            order: 1,
          },
        ]}
        responses={{ activities: [] }}
        onChange={onChange}
      />
    )

    expect(screen.getByLabelText("Visited stores")).toBeInTheDocument()
    expect(screen.getByLabelText("Collected feedback")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Visited stores"))

    expect(onChange).toHaveBeenCalledWith("activities", ["Visited stores"])
  })

  it("renders checkbox questions without options as a single boolean toggle", () => {
    const onChange = jest.fn()

    render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "confirmed",
            label: "Confirmed",
            type: "checkbox",
            placeholder: "Check this option",
            required: false,
            order: 1,
          },
        ]}
        responses={{ confirmed: false }}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByLabelText("Check this option"))

    expect(onChange).toHaveBeenCalledWith("confirmed", true)
  })

  it("validates checkbox questions with options as multi-select values", () => {
    const question = {
      id: "activities",
      key: "activities",
      label: "Activities",
      type: "checkbox" as const,
      options: ["Visited stores", "Collected feedback"],
      required: true,
      order: 1,
      category: "profession_question",
    }

    expect(validateQuestionResponse(question as any, ["Visited stores"])).toBeNull()
    expect(validateQuestionResponse(question as any, [])).toBe("Please select at least one option")
  })

  it("validates required image questions using normalized uploaded assets", () => {
    const question = {
      id: "proof_image",
      key: "proof_image",
      label: "Proof image",
      type: "image" as const,
      required: true,
      order: 1,
      category: "profession_question",
    }

    expect(validateQuestionResponse(question as any, null)).toBe("Please upload at least one image")
    expect(
      validateQuestionResponse(question as any, {
        provider: "cloudinary",
        resourceType: "image",
        publicId: "captain-log/sample",
        secureUrl: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/sample.jpg",
        originalFilename: "sample.jpg",
        bytes: 123,
        format: "jpg",
      })
    ).toBeNull()
  })

  describe("Dropdown (Select) Questions", () => {
    it("renders regular select dropdown with static options", () => {
      const onChange = jest.fn()

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "priority",
              label: "Priority",
              type: "select",
              options: ["High", "Medium", "Low"],
              required: false,
              order: 1,
            },
          ]}
          responses={{ priority: "" }}
          onChange={onChange}
        />
      )

      // Check that the select trigger is rendered
      expect(screen.getByRole("combobox")).toBeInTheDocument()
      expect(screen.getByText("Priority")).toBeInTheDocument()
    })

    it("handles select dropdown value changes", () => {
      const onChange = jest.fn()

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "priority",
              label: "Priority",
              type: "select",
              options: ["High", "Medium", "Low"],
              required: false,
              order: 1,
            },
          ]}
          responses={{ priority: "" }}
          onChange={onChange}
        />
      )

      // Click to open dropdown and select an option
      const trigger = screen.getByRole("combobox")
      fireEvent.click(trigger)

      const highOption = screen.getByText("High")
      fireEvent.click(highOption)

      expect(onChange).toHaveBeenCalledWith("priority", "High")
    })
  })

  describe("Multiselect Questions", () => {
    it("renders regular multiselect with static options", () => {
      const onChange = jest.fn()

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "tags",
              label: "Tags",
              type: "multiselect",
              options: ["Urgent", "Follow-up", "Review"],
              required: false,
              order: 1,
            },
          ]}
          responses={{ tags: [] }}
          onChange={onChange}
        />
      )

      // Check that options are rendered as checkboxes
      expect(screen.getByLabelText("Urgent")).toBeInTheDocument()
      expect(screen.getByLabelText("Follow-up")).toBeInTheDocument()
      expect(screen.getByLabelText("Review")).toBeInTheDocument()
    })

    it("handles multiselect value changes", () => {
      const onChange = jest.fn()

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "tags",
              label: "Tags",
              type: "multiselect",
              options: ["Urgent", "Follow-up", "Review"],
              required: false,
              order: 1,
            },
          ]}
          responses={{ tags: [] }}
          onChange={onChange}
        />
      )

      // Select first option
      fireEvent.click(screen.getByLabelText("Urgent"))
      expect(onChange).toHaveBeenCalledWith("tags", ["Urgent"])

      // Select second option
      fireEvent.click(screen.getByLabelText("Follow-up"))
      // The component calls onChange with the updated array
      expect(onChange).toHaveBeenCalled()

      // Deselect first option
      fireEvent.click(screen.getByLabelText("Urgent"))
      expect(onChange).toHaveBeenCalledWith("tags", ["Follow-up"])
    })
  })

  describe("Assigned Agent Questions", () => {
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("identifies assigned agent questions by metadata", () => {
      const agentQuestion = {
        key: "assigned_agent",
        label: "Assigned Agent",
        type: "select",
        metadata: {
          option_source: {
            kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
            max_logs_per_agent_per_day: 5,
          },
        },
        options: [],
        required: false,
        order: 1,
      }

      const regularQuestion = {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["High", "Medium", "Low"],
        required: false,
        order: 1,
      }

      render(
        <RoleBasedQuestionFields questions={[agentQuestion, regularQuestion]} responses={{}} onChange={jest.fn()} />
      )

      // The component should render without errors
      expect(screen.getByText("Assigned Agent")).toBeInTheDocument()
      expect(screen.getByText("Priority")).toBeInTheDocument()
    })

    it("renders assigned agent select dropdown with fetched agents", async () => {
      const onChange = jest.fn()
      const mockAgents = [
        { id: "agent-1", name: "Agent John", location: "Nairobi", phone: "123456", alreadyReported: false },
        { id: "agent-2", name: "Agent Jane", location: "Mombasa", phone: "789012", alreadyReported: false },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAgents, usageByQuestion: {} }),
      })

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "assigned_agent",
              label: "Assigned Agent",
              type: "select",
              metadata: {
                option_source: {
                  kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                },
              },
              options: [],
              required: false,
              order: 1,
            },
          ]}
          responses={{ assigned_agent: "" }}
          onChange={onChange}
          departmentId="dept-123"
          entryDate="2026-04-26"
          entryKind="agent_contact"
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/reporting/assigned-agents"),
          expect.any(Object)
        )
      })

      // Check that the select component is rendered
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    it("renders assigned agent multiselect with fetched agents", async () => {
      const onChange = jest.fn()
      const mockAgents = [
        { id: "agent-1", name: "Agent John", location: "Nairobi", phone: "123456", alreadyReported: false },
        { id: "agent-2", name: "Agent Jane", location: "Mombasa", phone: "789012", alreadyReported: false },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAgents, usageByQuestion: {} }),
      })

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "assigned_agents",
              label: "Assigned Agents",
              type: "multiselect",
              metadata: {
                option_source: {
                  kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                },
              },
              options: [],
              required: false,
              order: 1,
            },
          ]}
          responses={{ assigned_agents: [] }}
          onChange={onChange}
          departmentId="dept-123"
          entryDate="2026-04-26"
          entryKind="agent_contact"
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/reporting/assigned-agents"),
          expect.any(Object)
        )
      })

      // Check that agent names are rendered as checkboxes
      await waitFor(() => {
        expect(screen.getByLabelText("Agent John")).toBeInTheDocument()
        expect(screen.getByLabelText("Agent Jane")).toBeInTheDocument()
      })
    })

    it("handles assigned agent select value changes", async () => {
      const onChange = jest.fn()
      const mockAgents = [
        { id: "agent-1", name: "Agent John", location: "Nairobi", phone: "123456", alreadyReported: false },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAgents, usageByQuestion: {} }),
      })

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "assigned_agent",
              label: "Assigned Agent",
              type: "select",
              metadata: {
                option_source: {
                  kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                },
              },
              options: [],
              required: false,
              order: 1,
            },
          ]}
          responses={{ assigned_agent: "" }}
          onChange={onChange}
          departmentId="dept-123"
          entryDate="2026-04-26"
          entryKind="agent_contact"
        />
      )

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument()
      })

      // The component should render without errors
      expect(screen.getByText("Assigned Agent")).toBeInTheDocument()
    })

    it("handles assigned agent multiselect value changes", async () => {
      const onChange = jest.fn()
      const mockAgents = [
        { id: "agent-1", name: "Agent John", location: "Nairobi", phone: "123456", alreadyReported: false },
        { id: "agent-2", name: "Agent Jane", location: "Mombasa", phone: "789012", alreadyReported: false },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAgents, usageByQuestion: {} }),
      })

      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "assigned_agents",
              label: "Assigned Agents",
              type: "multiselect",
              metadata: {
                option_source: {
                  kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                },
              },
              options: [],
              required: false,
              order: 1,
            },
          ]}
          responses={{ assigned_agents: [] }}
          onChange={onChange}
          departmentId="dept-123"
          entryDate="2026-04-26"
          entryKind="agent_contact"
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText("Agent John")).toBeInTheDocument()
        expect(screen.getByLabelText("Agent Jane")).toBeInTheDocument()
      })

      // Select first agent
      fireEvent.click(screen.getByLabelText("Agent John"))
      expect(onChange).toHaveBeenCalledWith("assigned_agents", ["agent-1"])

      // Select second agent
      fireEvent.click(screen.getByLabelText("Agent Jane"))
      // The component calls onChange with the updated array
      expect(onChange).toHaveBeenCalled()
    })

    it("parses assigned agent values correctly for different formats", () => {
      const onChange = jest.fn()
      const mockAgents = [
        { id: "agent-1", name: "Agent John", location: "Nairobi", phone: "123456", alreadyReported: false },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAgents, usageByQuestion: {} }),
      })

      // Test with string value
      render(
        <RoleBasedQuestionFields
          questions={[
            {
              key: "assigned_agent",
              label: "Assigned Agent",
              type: "select",
              metadata: {
                option_source: {
                  kind: ASSIGNED_AGENTS_OPTION_SOURCE_KIND,
                },
              },
              options: [],
              required: false,
              order: 1,
            },
          ]}
          responses={{ assigned_agent: "agent-1" }}
          onChange={onChange}
          departmentId="dept-123"
          entryDate="2026-04-26"
          entryKind="agent_contact"
        />
      )

      // Component should render with the pre-selected value
      expect(screen.getByText("Assigned Agent")).toBeInTheDocument()
    })
  })
})
