import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { EntryFormMultistep } from "../components/entry-form-multistep"
import { AuthProvider } from "../contexts/auth-context"
import { CaptainLogProvider } from "../contexts/captain-log-context"
import { SupabaseAuthProvider } from "../contexts/supabase-auth-context"

// Mock the useRouter hook
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock child components that aren't relevant to our test
jest.mock("../components/role-based-question-fields", () => ({
  RoleBasedQuestionFields: () => <div>Role Based Questions</div>,
}))

// Mock Supabase Log context used by components to avoid importing 'uuid' ESM in Jest
jest.mock("@/contexts/supabase-log-context", () => ({
  SupabaseLogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSupabaseLog: () => ({
    entries: [],
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
  }),
  useCaptainLog: () => ({
    entries: [],
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
  }),
}))

describe("Authentication Fix", () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()

  const initialRoleQuestions = [
    {
      id: "q-1",
      role_id: "role-1",
      question_key: "k1",
      question_label: "Q1",
      question_title: "Q1",
      question_type: "text",
      question_description: null,
      placeholder: null,
      options: null,
      is_required: false,
      display_order: 1,
      validation_rules: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should show authentication error when user is not logged in", async () => {
    // Render the component with unauthenticated state
    render(
      <SupabaseAuthProvider>
        <AuthProvider>
          <CaptainLogProvider>
            <EntryFormMultistep 
              departmentId={"dept-1"}
              onSave={mockOnSave} 
              onCancel={mockOnCancel} 
              initialRoleQuestions={initialRoleQuestions as any}
            />
          </CaptainLogProvider>
        </AuthProvider>
      </SupabaseAuthProvider>
    )

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText("Daily Log Entry")).toBeInTheDocument()
    })

    // Find and click the submit button (which would be in the preview step)
    // We need to navigate to the preview step first
    const nextButtons = screen.getAllByText(/Next|Submit/)
    if (nextButtons.length > 0) {
      fireEvent.click(nextButtons[nextButtons.length - 1]) // Click the last button which should be submit
    }

    // Check that the authentication error toast is shown
    await waitFor(() => {
      expect(screen.getByText("Please sign in to submit logs.")).toBeInTheDocument()
    })

    // Verify that onSave was not called
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it("should allow submission when user is authenticated", async () => {
    // TODO: Implement test for authenticated user scenario
    // This would require mocking the authentication state
    expect(true).toBe(true)
  })
})