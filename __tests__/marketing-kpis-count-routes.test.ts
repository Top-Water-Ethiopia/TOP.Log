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
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("marketing count KPI routes", () => {
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

  it("counts major activities by dmal", async () => {
    const builder = createThenableBuilder({ count: 4, error: null })
    const fromMock = jest.fn().mockReturnValue(builder)
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    })

    const route = require("@/app/api/marketing/kpis/major-activities-count/route")
    const res = await route.GET({ url: "http://localhost/api/marketing/kpis/major-activities-count?dateFrom=2026-05-01&dateTo=2026-05-02" } as any)
    const body = await res.json()
    expect(body.kpi).toBe("major_activities_count")
    expect(body.value).toBe(4)
    expect(builder.eq).toHaveBeenCalledWith("entry_kind", "dmal")
  })

  it("counts supervisor daily reports by daily_supervisors_report", async () => {
    const builder = createThenableBuilder({ count: 2, error: null })
    const fromMock = jest.fn().mockReturnValue(builder)
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    })

    const route = require("@/app/api/marketing/kpis/supervisor-daily-reports-count/route")
    const res = await route.GET({ url: "http://localhost/api/marketing/kpis/supervisor-daily-reports-count?dateFrom=2026-05-01&dateTo=2026-05-02" } as any)
    const body = await res.json()
    expect(body.kpi).toBe("supervisor_daily_reports_count")
    expect(body.value).toBe(2)
    expect(builder.eq).toHaveBeenCalledWith("entry_kind", "daily_supervisors_report")
  })
})

