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

const supabaseServer = jest.requireMock("@/lib/supabase/server")
const routeModule = require("@/app/api/access-requests/route")

describe("/api/access-requests", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("returns 401 if not authenticated", async () => {
    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error("no") }) },
      from: jest.fn(),
    }
    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const req: any = {
      json: async () => ({ department_id: null, requested_role: null, message: "hi" }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("creates an access request for authenticated user", async () => {
    const insertedRow = {
      id: "r1",
      user_id: "u1",
      requester_email: "u1@example.com",
      department_id: null,
      requested_role: null,
      message: "Need access",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const insertChain = {
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }),
      }),
    }

    const accessRequestsTable = {
      insert: jest.fn().mockReturnValue(insertChain),
    }

    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "u1", email: "u1@example.com" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "access_requests") return accessRequestsTable
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const req: any = {
      json: async () => ({ department_id: null, requested_role: null, message: "Need access" }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: "r1", status: "pending" })
    expect(accessRequestsTable.insert).toHaveBeenCalled()
  })
})

export {}
