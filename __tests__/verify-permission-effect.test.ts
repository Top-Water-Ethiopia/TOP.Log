jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/supabase/admin", () => {
  const mock = { from: jest.fn() }
  return { adminSupabase: mock, __adminMock: mock }
})

const supabaseServer = jest.requireMock("@/lib/supabase/server")

describe("verifyPermissionFromRequest effect filtering", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("denies access when only a deny permission exists", async () => {
    const { verifyPermissionFromRequest } = require("@/lib/rbac/server")

    const rolePermissionsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role_id: "role-1" }, error: null }),
    }

    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return profileChain
        if (table === "role_permissions") return rolePermissionsChain
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const request = { headers: { get: () => null } } as any
    const res = await verifyPermissionFromRequest(request, "admin.system")

    expect(rolePermissionsChain.eq).toHaveBeenCalledWith("effect", "allow")
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })
})
