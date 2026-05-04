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

const mockCreateClient = jest.fn()
const mockAdminFrom = jest.fn()

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

jest.mock("@/lib/supabase/admin", () => ({
  adminSupabase: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
  },
}))

const routeModule = require("@/app/api/departments/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/departments", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the normalized profession key for active department membership", async () => {
    // Current route calls getUserEffectiveDepartmentMemberships
    // which queries user_department_memberships
    const membershipBuilder = createThenableBuilder({
      data: [{
        department_id: "dept-1",
        membership_type: "profession",
        role_id: "role-1",
        department: {
          id: "dept-1",
          name: "Sales",
          description: null,
          is_active: true,
        },
        role: {
          id: "role-1",
          name: "sales-promoter",
          display_name: "Sales Promoter"
        }
      }],
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
        if (table === "user_department_memberships") return membershipBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return createThenableBuilder({
          data: { role_id: "role-1" },
          error: null,
        })
      }

      if (table === "role_permissions") {
        return createThenableBuilder({
          data: [],
          error: null,
        })
      }

      throw new Error(`Unexpected admin table ${table}`)
    })

    const response = await routeModule.GET()

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data[0]).toMatchObject({
      department_id: "dept-1",
      roleKey: "sales-promoter",
      roleType: "profession"
    })
    expect(json.hasSystemWideAccess).toBe(false)
  })
})
