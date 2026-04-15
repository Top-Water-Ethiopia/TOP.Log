import React from "react"
import { render, screen } from "@testing-library/react"

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({ user: { email: "user@example.com" }, profile: { name: "" } }),
}))

jest.mock("@/components/ui/select", () => {
  const React = require("react")

  const Select = ({ children }: any) => <div data-testid="select">{children}</div>
  const SelectTrigger = ({ children }: any) => <button type="button">{children}</button>
  const SelectValue = ({ placeholder }: any) => <span>{placeholder}</span>
  const SelectContent = ({ children }: any) => <div>{children}</div>
  const SelectItem = ({ children, value }: any) => (
    <div role="option" data-value={value}>
      {children}
    </div>
  )

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

const { RoleBasedQuestionFields } = require("@/components/role-based-question-fields")

describe("RoleBasedQuestionFields assigned agent options", () => {
  it("renders select option labels for object options (value/label)", () => {
    render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "agent",
            label: "Who did you provide service to?",
            type: "select",
            required: true,
            order: 0,
            options: [
              { value: "8d0319cf-afed-4aad-a888-2fea88ddc23f", label: "Samuel (Mobile)" },
              { value: "790c292f-3b87-4bf0-8b3d-1bb8a8b8538d", label: "Abel (Mobile)" },
            ],
          },
        ]}
        responses={{}}
        onChange={() => {}}
      />
    )

    expect(screen.getByText("Samuel (Mobile)")).toBeInTheDocument()
    expect(screen.getByText("Abel (Mobile)")).toBeInTheDocument()
    expect(screen.queryByText("8d0319cf-afed-4aad-a888-2fea88ddc23f")).not.toBeInTheDocument()
  })
})

