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

const { createClient } = jest.requireMock("@/lib/supabase/server")
const routeModule = require("@/app/api/reporting/available-entry-kinds/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/reporting/available-entry-kinds", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("uses the profession-scoped config label for reachable kinds", async () => {
    const configBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          label: "Daily Report",
          color: "#123456",
          icon: "FileText",
          description: "Profession-scoped standard label",
          is_default: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: true,
          department_profession_id: "sales-promoter",
        },
      ],
      error: null,
    })

    const questionsBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          department_id: "dept-1",
          department_profession_id: "profession-uuid-1",
          department_role: "sales-promoter",
          is_active: true,
        },
      ],
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "scope_entry_kinds") return configBuilder
        if (table === "role_questions") return questionsBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1&role=sales-promoter",
    } as Request)

    expect(configBuilder.eq).toHaveBeenCalledWith("department_id", "dept-1")
    expect(configBuilder.eq).toHaveBeenCalledWith("department_profession_id", "sales-promoter")
    expect(configBuilder.is).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          entry_kind: "standard",
          label: "Daily Report",
          color: "#123456",
          icon: "FileText",
          description: "Profession-scoped standard label",
          is_default: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: true,
        },
      ],
    })
  })

  it("falls back to department-scoped configs when no profession is requested", async () => {
    const configBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          label: "Department Standard",
          color: "#6B7280",
          icon: "FileText",
          description: "Department default",
          is_default: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
          department_profession_id: null,
        },
      ],
      error: null,
    })

    const questionsBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          department_id: "dept-1",
          department_profession_id: null,
          department_role: null,
          is_active: true,
        },
      ],
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "scope_entry_kinds") return configBuilder
        if (table === "role_questions") return questionsBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1",
    } as Request)

    expect(configBuilder.eq).toHaveBeenCalledWith("department_id", "dept-1")
    expect(configBuilder.is).toHaveBeenCalledWith("department_profession_id", null)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          entry_kind: "standard",
          label: "Department Standard",
          color: "#6B7280",
          icon: "FileText",
          description: "Department default",
          is_default: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
        },
      ],
    })
  })
})
