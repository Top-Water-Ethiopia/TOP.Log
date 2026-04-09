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

jest.mock("@/lib/supabase/admin", () => {
  const mock = {
    from: jest.fn(),
  }

  return { adminSupabase: mock, __adminMock: mock }
})

jest.mock("@/lib/server/marketing-agents", () => ({
  getMarketingDepartmentById: jest.fn(),
  getSalesPromoterAssignment: jest.fn(),
}))

const { createClient } = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const { getMarketingDepartmentById, getSalesPromoterAssignment } = jest.requireMock("@/lib/server/marketing-agents")
const routeModule = require("@/app/api/reporting/assigned-agents/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/reporting/assigned-agents", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    })
  })

  it("returns assigned agents plus per-question usage counts for the selected entry kind", async () => {
    getMarketingDepartmentById.mockResolvedValue({ id: "dept-marketing", name: "Marketing" })
    getSalesPromoterAssignment.mockResolvedValue({
      departmentId: "dept-marketing",
      departmentName: "Marketing",
      professionId: "profession-1",
      professionKey: "sales-promoter",
      professionLabel: "Sales Promoter",
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "marketing_agents") {
        return createThenableBuilder({
          data: [
            {
              id: "agent-1",
              name: "Agent One",
              location: "Addis Ababa",
              phone_e164: "+251912345678",
              phone_raw: null,
              is_active: true,
            },
            {
              id: "agent-2",
              name: "Agent Two",
              location: "Adama",
              phone_e164: null,
              phone_raw: "0911111111",
              is_active: true,
            },
          ],
          error: null,
        })
      }

      if (table === "captain_log_entries") {
        return createThenableBuilder({
          data: [{ id: "entry-1" }],
          error: null,
        })
      }

      if (table === "custom_responses") {
        return createThenableBuilder({
          data: [
            {
              question_key: "agent_name",
              value: { value: "agent-2", label: "Agent Two" },
            },
          ],
          error: null,
        })
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/assigned-agents?departmentId=dept-marketing&date=2026-04-03&entryKind=agent_visit&questionKey=agent_name",
    } as Request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.data).toEqual([
      {
        id: "agent-1",
        name: "Agent One",
        location: "Addis Ababa",
        phone: "+251912345678",
        alreadyReported: false,
      },
      {
        id: "agent-2",
        name: "Agent Two",
        location: "Adama",
        phone: "0911111111",
        alreadyReported: false,
      },
    ])
    expect(body.usageByQuestion).toEqual({
      agent_name: {
        "agent-2": 1,
      },
    })
  })

  it("rejects users who are not active Marketing Sales Promoter members", async () => {
    getMarketingDepartmentById.mockResolvedValue({ id: "dept-marketing", name: "Marketing" })
    getSalesPromoterAssignment.mockResolvedValue(null)

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/assigned-agents?departmentId=dept-marketing&date=2026-04-03",
    } as Request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Only Marketing Sales Promoters can access assigned agents")
  })
})
