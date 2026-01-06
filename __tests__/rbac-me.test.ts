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
const routeModule = require("@/app/api/rbac/me/route")

describe("/api/rbac/me", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  function makeSupabaseMock() {
    const userId = "user-1"

    const userProfilesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role_id: "role-1" }, error: null }),
    }

    const rolesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "role-1", name: "manager", level: 4 }, error: null }),
    }

    const permissionsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { resource: "entries", action: "read" },
          { resource: "users", action: "manage" },
        ],
        error: null,
      }),
    }

    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return userProfilesChain
        if (table === "roles") return rolesChain
        if (table === "permissions") return permissionsChain
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    return supabaseMock
  }

  it("returns role and permissions for authenticated user", async () => {
    const supabaseMock = makeSupabaseMock()
    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const res = await routeModule.GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.role).toEqual({ id: "role-1", name: "manager", level: 4 })
    expect(body.permissions).toEqual(["entries.read", "users.manage"])
  })

  it("returns 401 if not authenticated", async () => {
    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error("no") }) },
      from: jest.fn(),
    }
    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const res = await routeModule.GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Not authenticated")
  })
})
