import React from "react"
import { render, screen } from "@testing-library/react"
import { LogsList } from "@/components/logs/logs-list"

describe("LogsList", () => {
  it("shows the agent name for agent-call entries", () => {
    render(
      <LogsList
        logs={[
          {
            id: "entry-1",
            date: "2026-04-03",
            department_id: "dept-marketing",
            department_name: "Marketing",
            created_at: "2026-04-03T00:00:00.000Z",
            updated_at: "2026-04-03T00:00:00.000Z",
            response_count: 4,
            entry_kind: "agent_call",
            subject_agent_name: "Agent One",
            subject_agent_snapshot: {
              name: "Agent One",
              location: "Addis Ababa",
              phone: "+251912345678",
            },
          },
        ]}
        emptyTitle="No logs"
        emptyDescription="No logs yet"
        previewView="list"
      />
    )

    expect(screen.getByText("Agent One")).toBeInTheDocument()
    expect(screen.getByText("Agent Call")).toBeInTheDocument()
  })
})
