import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { validateQuestionResponse } from "@/lib/rbac/utils"

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-123", email: "sam@example.com" },
    profile: { id: "profile-1", user_id: "user-123", name: "Sam Tester", role_id: "admin-role", department_id: null, is_active: true, metadata: null, last_login: null },
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
})
