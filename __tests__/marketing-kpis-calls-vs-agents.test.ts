jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status ?? 200,
      async json() {
        return body
      },
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/rbac/server", () => ({
  verifyPermissionForDepartmentFromRequest: jest.fn(),
}))

jest.mock("@/lib/server/marketing", () => ({
  getMarketingDepartmentId: jest.fn(),
}))

jest.mock("@/lib/time-window/visibility-signature", () => ({
  computeVisibilitySignature: jest.fn(),
}))

const { createClient } = jest.requireMock("@/lib/supabase/server")
const { verifyPermissionForDepartmentFromRequest } = jest.requireMock("@/lib/rbac/server")
const { getMarketingDepartmentId } = jest.requireMock("@/lib/server/marketing")
const { computeVisibilitySignature } = jest.requireMock("@/lib/time-window/visibility-signature")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    not: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("marketing dashboard KPIs - calls done vs agents contacted", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, "info").mockImplementation(() => {})
    getMarketingDepartmentId.mockResolvedValue("dept-marketing")
    verifyPermissionForDepartmentFromRequest.mockResolvedValue({ ok: true, userId: "user-1", roleId: "role-1" })
    computeVisibilitySignature.mockResolvedValue("sig")
  })

  afterEach(() => {
    ;(console.info as any).mockRestore?.()
  })

  it("counts total calls vs distinct agents correctly", async () => {
    const fromMock = jest.fn()
      .mockReturnValueOnce(createThenableBuilder({ count: 4, error: null }))
      .mockReturnValueOnce(
        createThenableBuilder({
          data: [
            { subject_agent_id: "agent-1" },
            { subject_agent_id: "agent-1" },
            { subject_agent_id: "agent-2" },
            { subject_agent_id: "agent-2" },
          ],
          error: null,
        })
      )

    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    }
    createClient.mockResolvedValue(supabase)

    const agentCallsRoute = require("@/app/api/marketing/kpis/agent-calls/route")
    const agentsContactedRoute = require("@/app/api/marketing/kpis/agents-contacted/route")

    const requestCalls: any = {
      url: "http://localhost/api/marketing/kpis/agent-calls?dateFrom=2026-04-03&dateTo=2026-04-03",
    }
    const requestAgents: any = {
      url: "http://localhost/api/marketing/kpis/agents-contacted?dateFrom=2026-04-03&dateTo=2026-04-03",
    }

    const callsRes = await agentCallsRoute.GET(requestCalls)
    const agentsRes = await agentsContactedRoute.GET(requestAgents)

    expect(callsRes.status).toBe(200)
    expect(agentsRes.status).toBe(200)

    const callsBody = await callsRes.json()
    const agentsBody = await agentsRes.json()

    expect(callsBody.kpi).toBe("agent_calls")
    expect(callsBody.value).toBe(4)

    expect(agentsBody.kpi).toBe("agents_contacted")
    expect(agentsBody.value).toBe(2)

    // Ensures the two cards are not accidentally driven by the same aggregation.
    expect(callsBody.value).toBeGreaterThan(agentsBody.value)

    expect(fromMock).toHaveBeenCalledTimes(2)
  })
})
