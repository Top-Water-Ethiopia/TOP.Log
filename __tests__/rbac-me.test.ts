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

jest.mock("@/lib/rbac/server", () => ({
  getEffectivePermissionsForUser: jest.fn(),
}))

const supabaseServer = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const { getEffectivePermissionsForUser } = jest.requireMock("@/lib/rbac/server")
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

    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return userProfilesChain
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    return supabaseMock
  }

  it("returns role and permissions for authenticated user", async () => {
    const supabaseMock = makeSupabaseMock()
    supabaseServer.createClient.mockResolvedValue(supabaseMock)
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { role_id: "role-1" }, error: null }),
            }),
          }),
        }
      }

      if (table === "roles") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: "role-1", name: "manager", level: 4 }, error: null }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })
    getEffectivePermissionsForUser.mockResolvedValue({
      roleId: "role-1",
      globalPermissions: ["entries.read", "users.manage"],
      departmentAccess: [
        {
          departmentId: "dept-1",
          department: { id: "dept-1", name: "Sales" },
          accessLevelId: "access-1",
          accessLevel: { id: "access-1", name: "department-manager", display_name: "Department Manager", level: 4 },
          permissions: ["departments.update", "departments.members.read"],
        },
      ],
    })

    const res = await routeModule.GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.role).toEqual({ id: "role-1", name: "manager", level: 4 })
    expect(body.permissions).toEqual(["entries.read", "users.manage"])
    expect(body.globalPermissions).toEqual(["entries.read", "users.manage"])
    expect(body.departmentAccess).toHaveLength(1)
    expect(body.departmentAccess[0]).toMatchObject({
      departmentId: "dept-1",
      accessLevelId: "access-1",
    })
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
