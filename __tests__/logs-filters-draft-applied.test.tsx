import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { LogsFilters } from "@/components/logs/logs-filters"
import type { LogsViewMode } from "@/lib/logs-page-filters"

const replaceMock = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

describe("LogsFilters (draft vs applied)", () => {
  const departments = [
    { id: "dept-1", name: "Sales" },
    { id: "dept-2", name: "Marketing" },
  ]

  const professionRoles = [
    { id: "prof-1", name: "sr", label: "Sales Rep" },
    { id: "prof-2", name: "tl", label: "Team Lead" },
  ]

  const entryKinds = [
    { entry_kind: "standard", label: "Standard" },
    { entry_kind: "agent_call", label: "Agent Call" },
  ]

  const baseProps = {
    currentView: "list" as LogsViewMode,
    departments,
    hasFilters: true,
    isBasicUser: false,
    month: "2026-04",
    professionRoles,
    entryKinds,
  }

  beforeEach(() => {
    jest.useFakeTimers()
    replaceMock.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("does not auto-apply department changes; requires Apply", () => {
    render(<LogsFilters {...baseProps} departmentId="dept-1" />)

    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: "dept-2" } })
    expect(replaceMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /apply/i }))
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(String(replaceMock.mock.calls[0][0])).toContain("departmentId=dept-2")
  })

  it("batches entry kind changes into pending profession debounce (no double navigation)", () => {
    render(<LogsFilters {...baseProps} departmentId="dept-1" professionRoleId="prof-1" />)

    fireEvent.change(screen.getByLabelText(/profession/i), { target: { value: "prof-2" } })
    fireEvent.change(screen.getByLabelText(/entry kind/i), { target: { value: "agent_call" } })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(replaceMock).toHaveBeenCalledTimes(1)
    const href = String(replaceMock.mock.calls[0][0])
    expect(href).toContain("professionRoleId=prof-2")
    expect(href).toContain("entryKind=agent_call")
  })

  it("popstate cancels pending apply (no navigation after back/forward)", () => {
    render(<LogsFilters {...baseProps} departmentId="dept-1" />)

    fireEvent.change(screen.getByLabelText(/search by name/i), { target: { value: "fraol" } })
    // debounce scheduled (400ms)
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"))
      jest.advanceTimersByTime(500)
    })

    expect(replaceMock).toHaveBeenCalledTimes(0)
  })
})

