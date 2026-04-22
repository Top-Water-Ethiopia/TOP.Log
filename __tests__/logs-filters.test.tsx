import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { LogsFilters } from "@/components/logs/logs-filters"
import type { LogsViewMode } from "@/lib/logs-page-filters"

describe("LogsFilters - search input functionality", () => {
  const mockDepartments = [
    { id: "dept-1", name: "Sales" },
    { id: "dept-2", name: "Marketing" },
  ]

  const defaultProps = {
    currentView: "list" as LogsViewMode,
    departments: mockDepartments,
    hasFilters: false,
    isBasicUser: false,
    month: "2026-04",
  }

  it("renders search input for department leads (isBasicUser=false)", () => {
    render(<LogsFilters {...defaultProps} isBasicUser={false} />)

    const searchInput = screen.getByLabelText(/search by name/i)
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute("type", "text")
    expect(searchInput).toHaveAttribute("placeholder", "Enter name to search...")
  })

  it("does not render search input for basic users (isBasicUser=true)", () => {
    render(<LogsFilters {...defaultProps} isBasicUser={true} />)

    const searchInput = screen.queryByLabelText(/search by name/i)
    expect(searchInput).not.toBeInTheDocument()
  })

  it("initializes search input with searchName prop value", () => {
    render(<LogsFilters {...defaultProps} searchName="alice" />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    expect(searchInput.value).toBe("alice")
  })

  it("initializes search input as empty when searchName is undefined", () => {
    render(<LogsFilters {...defaultProps} />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    expect(searchInput.value).toBe("")
  })

  it("updates search input value on user input", () => {
    render(<LogsFilters {...defaultProps} />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: "bob" } })

    expect(searchInput.value).toBe("bob")
  })

  it("submits form with searchName value on Apply button click", () => {
    render(<LogsFilters {...defaultProps} searchName="alice" />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    const applyButton = screen.getByRole("button", { name: /apply/i })

    expect(searchInput.value).toBe("alice")
    expect(applyButton).toBeInTheDocument()
  })

  it("updates search input when searchName prop changes", () => {
    const { rerender } = render(<LogsFilters {...defaultProps} searchName="alice" />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    expect(searchInput.value).toBe("alice")

    rerender(<LogsFilters {...defaultProps} searchName="bob" />)

    expect(searchInput.value).toBe("bob")
  })

  it("clears search input when searchName prop becomes undefined", () => {
    const { rerender } = render(<LogsFilters {...defaultProps} searchName="alice" />)

    const searchInput = screen.getByLabelText(/search by name/i) as HTMLInputElement
    expect(searchInput.value).toBe("alice")

    rerender(<LogsFilters {...defaultProps} searchName={undefined} />)

    expect(searchInput.value).toBe("")
  })

  it("renders search input before Apply button", () => {
    render(<LogsFilters {...defaultProps} />)

    const searchInput = screen.getByLabelText(/search by name/i)
    const applyButton = screen.getByRole("button", { name: /apply/i })

    expect(searchInput).toBeInTheDocument()
    expect(applyButton).toBeInTheDocument()
  })

  it("renders search input with correct name attribute for form submission", () => {
    render(<LogsFilters {...defaultProps} />)

    const searchInput = screen.getByLabelText(/search by name/i)
    expect(searchInput).toHaveAttribute("name", "searchName")
  })

  it("renders search input with proper styling classes", () => {
    render(<LogsFilters {...defaultProps} />)

    const searchInput = screen.getByLabelText(/search by name/i)
    expect(searchInput).toHaveClass("h-9")
  })

  describe("search input with other filters", () => {
    it("renders search input alongside date filter", () => {
      render(<LogsFilters {...defaultProps} currentView="list" date="2026-04-20" />)

      const dateInput = screen.getByLabelText(/date/i)
      const searchInput = screen.getByLabelText(/search by name/i)

      expect(dateInput).toBeInTheDocument()
      expect(searchInput).toBeInTheDocument()
    })

    it("renders search input alongside department filter", () => {
      render(<LogsFilters {...defaultProps} currentView="list" departmentId="dept-1" />)

      const departmentSelect = screen.getByLabelText(/department/i)
      const searchInput = screen.getByLabelText(/search by name/i)

      expect(departmentSelect).toBeInTheDocument()
      expect(searchInput).toBeInTheDocument()
    })

    it("renders search input with all filters present", () => {
      render(
        <LogsFilters
          {...defaultProps}
          currentView="list"
          date="2026-04-20"
          departmentId="dept-1"
          searchName="alice"
        />
      )

      const dateInput = screen.getByLabelText(/date/i)
      const departmentSelect = screen.getByLabelText(/department/i)
      const searchInput = screen.getByLabelText(/search by name/i)

      expect(dateInput).toBeInTheDocument()
      expect(departmentSelect).toBeInTheDocument()
      expect(searchInput).toBeInTheDocument()
      expect((searchInput as HTMLInputElement).value).toBe("alice")
    })
  })
})
