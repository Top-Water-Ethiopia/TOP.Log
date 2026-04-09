import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

jest.mock("@/components/entry-form-multistep", () => ({
  EntryFormMultistep: ({
    onDateChange,
    onSave,
    onCancel,
  }: {
    onDateChange?: (date: string) => void
    onSave: (result?: { entryKind: "standard" | "agent_call"; date: string }) => void
    onCancel: (selectedDate?: string) => void
  }) => (
    <div>
      <button type="button" onClick={() => onDateChange?.("2026-04-01")}>
        change date
      </button>
      <button type="button" onClick={() => onDateChange?.("2026-04-02")}>
        keep date
      </button>
      <button type="button" onClick={() => onSave({ entryKind: "standard", date: "2026-04-01" })}>
        save standard
      </button>
      <button type="button" onClick={() => onSave({ entryKind: "agent_call", date: "2026-04-01" })}>
        save agent call
      </button>
      <button type="button" onClick={() => onCancel("2026-04-01")}>
        cancel
      </button>
    </div>
  ),
}))

const { EntryFormMultistepClient } = require("@/app/logs/new/client")

describe("EntryFormMultistepClient", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("updates the URL when the selected date changes", () => {
    render(
      <EntryFormMultistepClient
        departmentId="dept-1"
        departmentName="Engineering"
        date="2026-04-02"
        allowedDates={["2026-04-01", "2026-04-02"]}
        initialExistingEntryId={null}
        initialRoleQuestions={[]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "change date" }))

    expect(mockReplace).toHaveBeenCalledWith("/logs/new?departmentId=dept-1&date=2026-04-01", { scroll: false })
  })

  it("does not replace the route when the selected date is unchanged", () => {
    render(
      <EntryFormMultistepClient
        departmentId="dept-1"
        departmentName="Engineering"
        date="2026-04-02"
        allowedDates={["2026-04-01", "2026-04-02"]}
        initialExistingEntryId={null}
        initialRoleQuestions={[]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "keep date" }))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirects standard saves and cancels back to logs, but keeps agent-call saves on the page", () => {
    render(
      <EntryFormMultistepClient
        departmentId="dept-1"
        departmentName="Engineering"
        date="2026-04-02"
        allowedDates={["2026-04-01", "2026-04-02"]}
        initialExistingEntryId={null}
        initialRoleQuestions={[]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "save standard" }))
    expect(mockPush).toHaveBeenCalledWith("/logs?departmentId=dept-1&date=2026-04-01")

    mockPush.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "save agent call" }))
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(mockPush).toHaveBeenCalledWith("/logs?departmentId=dept-1&date=2026-04-01")
  })
})
