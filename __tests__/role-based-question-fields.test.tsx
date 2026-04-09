import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { validateQuestionResponse } from "@/lib/rbac/utils"

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
})
