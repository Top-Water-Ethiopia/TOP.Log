jest.mock("dotenv", () => ({
  config: jest.fn(),
}))

import { analyzeAgentContactRows } from "../scripts/check-marketing-call-kpis"

describe("unspecified data detection - marketing agent contacts", () => {
  it("treats rows with null subject_agent_id as unspecified and duplicates as extra logs", () => {
    const rows = [
      { id: "row-1", subject_agent_id: "agent-1", subject_agent_snapshot: { name: "A" } },
      { id: "row-2", subject_agent_id: "agent-1", subject_agent_snapshot: { name: "A" } },
      { id: "row-3", subject_agent_id: "agent-2", subject_agent_snapshot: { name: "B" } },
      { id: "row-4", subject_agent_id: null, subject_agent_snapshot: null },
    ]

    const analysis = analyzeAgentContactRows(rows as any)

    expect(analysis.callsDone).toBe(4)
    expect(analysis.agentsContacted).toBe(2)
    expect(analysis.missingAgentIdRows).toHaveLength(1)
    expect(analysis.extraLogsFromDuplicates).toBe(1)

    expect(analysis.duplicateAgents).toEqual([
      expect.objectContaining({
        agentId: "agent-1",
        count: 2,
        rowIds: ["row-1", "row-2"],
      }),
    ])
  })
})
