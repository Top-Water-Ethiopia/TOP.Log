import React from "react"
import { render, screen } from "@testing-library/react"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"

describe("RoleBasedQuestionFields", () => {
  it("uses normalized validationRules for number and date inputs", () => {
    render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "score",
            label: "Score",
            type: "number",
            required: false,
            order: 1,
            validationRules: {
              min_value: 10,
              max_value: 50,
              step: 5,
            },
          },
          {
            key: "due-date",
            label: "Due date",
            type: "date",
            required: false,
            order: 2,
            validationRules: {
              min_date: "2026-04-01",
              max_date: "2026-04-30",
            },
          },
        ]}
        responses={{}}
        onChange={jest.fn()}
        renderMode="fieldsOnly"
      />
    )

    const numberInput = screen.getByRole("spinbutton")
    expect(numberInput).toHaveAttribute("min", "10")
    expect(numberInput).toHaveAttribute("max", "50")
    expect(numberInput).toHaveAttribute("step", "5")
    expect(screen.queryByText("/100")).not.toBeInTheDocument()

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toHaveAttribute("min", "2026-04-01")
    expect(dateInput).toHaveAttribute("max", "2026-04-30")
  })

  it("uses neutral placeholders and does not force default number bounds", () => {
    render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "email",
            label: "Email",
            type: "email",
            required: false,
            order: 1,
          },
          {
            key: "website",
            label: "Website",
            type: "url",
            required: false,
            order: 2,
          },
          {
            key: "estimate",
            label: "Estimate",
            type: "number",
            required: false,
            order: 3,
          },
        ]}
        responses={{}}
        onChange={jest.fn()}
        renderMode="fieldsOnly"
      />
    )

    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("https://example.com")).toBeInTheDocument()

    const numberInput = screen.getByRole("spinbutton")
    expect(numberInput).not.toHaveAttribute("min")
    expect(numberInput).not.toHaveAttribute("max")
    expect(numberInput).not.toHaveAttribute("step")
  })
})
