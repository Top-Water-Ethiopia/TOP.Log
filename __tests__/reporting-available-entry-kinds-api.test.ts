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

const { createClient: mockCreateClient } = jest.requireMock("@/lib/supabase/server")
const routeModule = require("@/app/api/reporting/available-entry-kinds/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(() => builder),
    or: jest.fn(() => builder),
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
          is_active: true,
        },
      ],
      error: null,
    })

    const questionsBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          department_id: "dept-1",
          department_profession_id: "afb7e9b0-b249-4d4a-aec6-e9f47b94d223",
          department_role: "sales-promoter",
          is_active: true,
        },
      ],
      error: null,
    })

    const membershipBuilder = createThenableBuilder({
      data: [{ role_id: "afb7e9b0-b249-4d4a-aec6-e9f47b94d223", roles: { name: "sales-promoter" } }],
      error: null,
    })

    const roleBuilder = createThenableBuilder({
      data: { name: "sales-promoter" },
      error: null,
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "scope_entry_kinds") return configBuilder
        if (table === "role_questions") return questionsBuilder
        if (table === "user_department_memberships") return membershipBuilder
        if (table === "roles") return roleBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })


    const ROLE_UUID = "afb7e9b0-b249-4d4a-aec6-e9f47b94d223";

    const response = await routeModule.GET({
      url: `http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1&role=${ROLE_UUID}`,
    } as Request)

    expect(configBuilder.eq).toHaveBeenCalledWith("department_id", "dept-1")
    expect(configBuilder.eq).toHaveBeenCalledWith("scope_type", "profession_personal")
    expect(configBuilder.eq).toHaveBeenCalledWith("profession_role_id", ROLE_UUID)
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
          is_active: true,
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
          question_scope_type: "dept_wide_personal",
          is_active: true,
        },
      ],
      error: null,
    })

    const membershipBuilder = createThenableBuilder({
      data: [],
      error: null,
    })

    const roleBuilder = createThenableBuilder({
      data: [],
      error: null,
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "scope_entry_kinds") return configBuilder
        if (table === "role_questions") return questionsBuilder
        if (table === "user_department_memberships") return membershipBuilder
        if (table === "roles") return roleBuilder
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

  it("handles entry kinds with questions across multiple steps", async () => {
    const configBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          label: "Multi-Step Report",
          is_active: true,
          department_id: "dept-1",
        },
      ],
      error: null,
    })

    const questionsBuilder = createThenableBuilder({
      data: [
        {
          entry_kind: "standard",
          department_id: "dept-1",
          question_scope_type: "dept_wide_personal",
          step: 1,
          is_active: true,
        },
        {
          entry_kind: "standard",
          department_id: "dept-1",
          question_scope_type: "dept_wide_personal",
          step: 2,
          is_active: true,
        },
      ],
      error: null,
    })

    const membershipBuilder = createThenableBuilder({ data: [], error: null })
    const roleBuilder = createThenableBuilder({ data: [], error: null })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "scope_entry_kinds") return configBuilder
        if (table === "role_questions") return questionsBuilder
        if (table === "user_department_memberships") return membershipBuilder
        if (table === "roles") return roleBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/available-entry-kinds?departmentId=dept-1",
    } as Request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].entry_kind).toBe("standard")
    expect(body.data[0].label).toBe("Multi-Step Report")
  })
})
