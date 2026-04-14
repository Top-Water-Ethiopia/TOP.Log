jest.mock("next/server", () => {
  return {
    NextResponse: {
      json: (body: any, init?: any) => ({
        status: init?.status ?? 200,
        async json() {
          return body
        },
      }),
    },
  }
})

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/entry-kinds/resolve", () => ({
  resolveEntryKinds: jest.fn(),
}))

const supabaseServer = jest.requireMock("@/lib/supabase/server")
const { resolveEntryKinds } = jest.requireMock("@/lib/entry-kinds/resolve")

const routeModule = require("@/app/api/reporting/available-entry-kinds/route")

describe("/api/reporting/available-entry-kinds", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  function makeSupabaseMock(params: {
    memberships?: Array<{ id?: string; name?: string }>
    questions?: any[]
  }) {
    const memberships = params.memberships ?? []
    const questions = params.questions ?? []

    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    data: memberships.map((m) => ({ role: { id: m.id, name: m.name } })),
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        if (table === "role_questions") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: questions, error: null }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    }
  }

  it("returns dept-wide personal kinds when question_scope_type is selected", async () => {
    const supabaseMock = makeSupabaseMock({
      memberships: [{ id: "prof-1", name: "sales-promoter" }],
      questions: [
        {
          entry_kind: "standard",
          department_id: "dept-1",
          department_profession_id: null,
          department_role: null,
          question_scope_type: "dept_wide_personal",
          is_active: true,
        },
      ],
    })
    supabaseServer.createClient.mockResolvedValue(supabaseMock)
    resolveEntryKinds.mockResolvedValue({
      data: [
        {
          entry_kind: "standard",
          label: "Standard",
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
        },
      ],
      meta: { used: "dept_wide_personal", state: "OK" },
    })

    const req = { url: "http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1&role=sales-promoter" }
    const res = await routeModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entry_kind: "standard",
          label: "Standard",
        }),
      ])
    )
  })

  it("returns profession-scoped kinds when role matches department_role", async () => {
    const supabaseMock = makeSupabaseMock({
      memberships: [{ id: "prof-1", name: "sales-promoter" }],
      questions: [
        {
          entry_kind: "agent_call",
          department_id: "dept-1",
          department_profession_id: null,
          department_role: "sales-promoter",
          question_scope_type: null,
          is_active: true,
        },
      ],
    })
    supabaseServer.createClient.mockResolvedValue(supabaseMock)
    resolveEntryKinds.mockResolvedValue({
      data: [
        {
          entry_kind: "agent_call",
          label: "Agent Call",
          is_default: true,
          is_active: true,
          supports_assigned_agent: true,
          allow_multiple_per_day: false,
        },
      ],
      meta: { used: "profession_personal", state: "OK" },
    })

    const req = { url: "http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1&role=sales-promoter" }
    const res = await routeModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entry_kind: "agent_call",
          label: "Agent Call",
        }),
      ])
    )
  })
})
