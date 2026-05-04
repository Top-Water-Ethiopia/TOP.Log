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

jest.mock("@/lib/rbac/server", () => ({
  verifyPermission: jest.fn(),
}))

jest.mock("@/lib/supabase/admin", () => {
  const mock = {
    from: jest.fn(),
    auth: {
      admin: {
        listUsers: jest.fn(),
      },
    },
  }

  return { adminSupabase: mock, __adminMock: mock }
})

jest.mock("@/lib/server/marketing-agents", () => ({
  getMarketingDepartment: jest.fn(),
  getSalesPromoterAssignment: jest.fn(),
}))

const { verifyPermission } = jest.requireMock("@/lib/rbac/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const { getMarketingDepartment, getSalesPromoterAssignment } = jest.requireMock("@/lib/server/marketing-agents")
const collectionRoute = require("@/app/api/admin/marketing-agents/route")
const itemRoute = require("@/app/api/admin/marketing-agents/[agentId]/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/admin/marketing-agents", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    verifyPermission.mockResolvedValue({ ok: true, userId: "admin-1", roleId: "role-admin" })
    getMarketingDepartment.mockResolvedValue({ id: "dept-marketing", name: "Marketing" })
  })

  it("GET returns active Sales Promoters and their assigned agents", async () => {
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "user_department_memberships") {
        return createThenableBuilder({
          data: [
            {
              user_id: "user-1",
              membership_type: "profession",
              role_id: "profession-1",
              role: {
                id: "profession-1",
                name: "sales-promoter",
                display_name: "Sales Promoter",
              },
            },
          ],
          error: null,
        })
      }

      if (table === "user_profiles") {
        return createThenableBuilder({
          data: [{ user_id: "user-1", name: "Promoter One" }],
          error: null,
        })
      }

      if (table === "marketing_agents") {
        return createThenableBuilder({
          data: [
            {
              id: "agent-1",
              department_id: "dept-marketing",
              sales_promoter_user_id: "user-1",
              name: "Agent One",
              location: "Addis Ababa",
              phone_e164: "+251912345678",
              phone_raw: null,
              is_active: true,
              created_at: "2026-04-03T00:00:00.000Z",
              updated_at: "2026-04-03T00:00:00.000Z",
            },
          ],
          error: null,
        })
      }

      throw new Error(`Unexpected table ${table}`)
    })

    __adminMock.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "user-1", email: "promoter@example.com" }],
      },
      error: null,
    })

    const response = await collectionRoute.GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.data.salesPromoters).toEqual([
      {
        user_id: "user-1",
        name: "Promoter One",
        email: "promoter@example.com",
        profession_id: "profession-1",
        profession_key: "sales-promoter",
        profession_label: "Sales Promoter",
      },
    ])
    expect(body.data.agents[0]).toMatchObject({
      id: "agent-1",
      name: "Agent One",
      sales_promoter: {
        user_id: "user-1",
        name: "Promoter One",
      },
    })
  })

  it("POST creates an agent with a normalized phone number", async () => {
    getSalesPromoterAssignment.mockResolvedValue({
      departmentId: "dept-marketing",
      departmentName: "Marketing",
      professionId: "profession-1",
      professionKey: "sales-promoter",
      professionLabel: "Sales Promoter",
    })

    const insertBuilder = createThenableBuilder({
      data: {
        id: "agent-1",
        department_id: "dept-marketing",
        sales_promoter_user_id: "user-1",
        name: "Agent One",
        location: "Addis Ababa",
        phone_e164: "+251912345678",
        phone_raw: "0912345678",
      },
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "marketing_agents") {
        return insertBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await collectionRoute.POST({
      json: async () => ({
        name: "Agent One",
        location: "Addis Ababa",
        phone: "0912345678",
        sales_promoter_user_id: "user-1",
      }),
    } as any)

    expect(response.status).toBe(201)
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: "dept-marketing",
        sales_promoter_user_id: "user-1",
        name: "Agent One",
        phone_e164: "+251912345678",
        phone_raw: "0912345678",
      })
    )
  })

  it("PATCH updates an existing agent and re-normalizes phone changes", async () => {
    getSalesPromoterAssignment.mockResolvedValue({
      departmentId: "dept-marketing",
      departmentName: "Marketing",
      professionId: "profession-1",
      professionKey: "sales-promoter",
      professionLabel: "Sales Promoter",
    })

    const loadBuilder = createThenableBuilder({
      data: {
        id: "agent-1",
        department_id: "dept-marketing",
        sales_promoter_user_id: "user-1",
        name: "Agent One",
        location: "Addis Ababa",
        phone_e164: "+251912345678",
        phone_raw: "0912345678",
        is_active: true,
      },
      error: null,
    })
    const updateBuilder = createThenableBuilder({
      data: {
        id: "agent-1",
        department_id: "dept-marketing",
        sales_promoter_user_id: "user-1",
        name: "Agent One Updated",
        location: "Hawassa",
        phone_e164: "+251977777777",
        phone_raw: "0977777777",
        is_active: true,
      },
      error: null,
    })

    let marketingAgentCallCount = 0
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "marketing_agents") {
        marketingAgentCallCount += 1
        return marketingAgentCallCount === 1 ? loadBuilder : updateBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await itemRoute.PATCH(
      {
        json: async () => ({
          name: "Agent One Updated",
          location: "Hawassa",
          phone: "0977777777",
          sales_promoter_user_id: "user-1",
        }),
      } as any,
      { params: Promise.resolve({ agentId: "agent-1" }) }
    )

    expect(response.status).toBe(200)
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Agent One Updated",
        location: "Hawassa",
        phone_e164: "+251977777777",
        phone_raw: "0977777777",
        sales_promoter_user_id: "user-1",
      })
    )
  })
})
