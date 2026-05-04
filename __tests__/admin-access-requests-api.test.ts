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

jest.mock("@/lib/supabase/admin", () => {
  const mock = { from: jest.fn() }
  return { adminSupabase: mock, __adminMock: mock }
})

const supabaseServer = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const routeModule = require("@/app/api/admin/access-requests/route")

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"

describe("/api/admin/access-requests", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  function makeCreateClientMockWithAdmin() {
    const userId = "admin-1"

    const userProfilesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role_id: ADMIN_ROLE_ID }, error: null }),
    }

    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return userProfilesChain
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    supabaseServer.createClient.mockResolvedValue(supabaseMock)
    return { supabaseMock, userId }
  }

  it("GET returns 403 if not admin", async () => {
    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { role_id: "not-admin" }, error: null }),
      })),
    }

    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const req: any = { url: "http://localhost/api/admin/access-requests?status=pending" }
    const res = await routeModule.GET(req)
    expect(res.status).toBe(403)
  })

  it("GET returns access requests", async () => {
    makeCreateClientMockWithAdmin()

    const rows = [
      {
        id: "r1",
        user_id: "u1",
        requester_email: "u1@example.com",
        department_id: null,
        requested_role: null,
        message: "Need access",
        status: "pending",
        resolved_by: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    const thenableQuery: any = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: any, reject: any) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    }

    const selectChain = {
      order: jest.fn().mockReturnValue(thenableQuery),
    }

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "access_requests") {
        return {
          select: jest.fn().mockReturnValue(selectChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const req: any = { url: "http://localhost/api/admin/access-requests?status=pending" }
    const res = await routeModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ id: "r1", status: "pending" })
  })

  it("PATCH updates access request status", async () => {
    const { userId } = makeCreateClientMockWithAdmin()

    const updated = {
      id: "r1",
      status: "approved",
      resolved_by: userId,
    }

    const single = jest.fn().mockResolvedValue({ data: updated, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const eq = jest.fn().mockReturnValue({ select })
    const update = jest.fn().mockReturnValue({ eq })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "access_requests") {
        return { update }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const req: any = {
      url: "http://localhost/api/admin/access-requests",
      json: async () => ({ id: "r1", status: "approved" }),
    }

    const res = await routeModule.PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: "r1", status: "approved" })
    expect(update).toHaveBeenCalled()
  })
})

export {}
