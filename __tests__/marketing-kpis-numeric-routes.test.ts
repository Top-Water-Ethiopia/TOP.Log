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

export {}

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

let createClient: any
let verifyPermissionForDepartmentFromRequest: any
let getMarketingDepartmentId: any
let computeVisibilitySignature: any

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    in: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("marketing numeric KPI routes", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.resetModules()
    ;({ createClient } = jest.requireMock("@/lib/supabase/server"))
    ;({ verifyPermissionForDepartmentFromRequest } = jest.requireMock("@/lib/rbac/server"))
    ;({ getMarketingDepartmentId } = jest.requireMock("@/lib/server/marketing"))
    ;({ computeVisibilitySignature } = jest.requireMock("@/lib/time-window/visibility-signature"))
    jest.spyOn(console, "info").mockImplementation(() => {})
    getMarketingDepartmentId.mockResolvedValue("dept-marketing")
    verifyPermissionForDepartmentFromRequest.mockResolvedValue({ ok: true, userId: "user-1", roleId: "role-1" })
    computeVisibilitySignature.mockResolvedValue("sig")
  })

  afterEach(() => {
    ;(console.info as any).mockRestore?.()
  })

  it("sums followers across resolved pairs and rejects negatives/pair mismatches", async () => {
    const fromMock = jest.fn()
      .mockReturnValueOnce(
        createThenableBuilder({
          data: [
            { question_label: "Q1", question_type: "number", entry_kind: "dmal", metadata: { legacy_question_key: "how_many_new_followers_were_gained" } },
            { question_label: "Q2", question_type: "number", entry_kind: "daily_supervisors_report", metadata: { legacy_question_key: "how_many_new_followers_did_you_bring" } },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createThenableBuilder({
          data: [
            { question_key: "how_many_new_followers_were_gained", value: "2.5", captain_log_entries: { entry_kind: "dmal" } },
            { question_key: " how_many_new_followers_did_you_bring ", value: 3, captain_log_entries: { entry_kind: "daily_supervisors_report" } },
            { question_key: "how_many_new_followers_were_gained", value: -1, captain_log_entries: { entry_kind: "dmal" } },
            { question_key: "how_many_new_followers_were_gained", value: 50, captain_log_entries: { entry_kind: "daily_supervisors_report" } },
          ],
          error: null,
        })
      )

    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    })

    const route = require("@/app/api/marketing/kpis/followers-added/route")
    const res = await route.GET({ url: "http://localhost/api/marketing/kpis/followers-added?dateFrom=2026-05-01&dateTo=2026-05-02" } as any)
    const body = await res.json()
    expect(body.kpi).toBe("followers_added")
    expect(body.value).toBe(5.5)
  })

  it("returns 0 for call minutes when no resolved config exists", async () => {
    const fromMock = jest.fn().mockReturnValueOnce(createThenableBuilder({ data: [], error: null }))
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    })

    const route = require("@/app/api/marketing/kpis/call-minutes/route")
    const res = await route.GET({ url: "http://localhost/api/marketing/kpis/call-minutes?dateFrom=2026-05-01&dateTo=2026-05-02" } as any)
    const body = await res.json()
    expect(body.kpi).toBe("call_minutes")
    expect(body.value).toBe(0)
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith("role_questions")
  })
})

