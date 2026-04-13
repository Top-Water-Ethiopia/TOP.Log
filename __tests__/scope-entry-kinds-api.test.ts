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

jest.mock("@/lib/rbac/server", () => ({
  verifyPermission: jest.fn(),
  verifyPermissionForDepartmentFromRequest: jest.fn(),
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/supabase/admin", () => {
  const mock = { from: jest.fn() }
  return { adminSupabase: mock, __adminMock: mock }
})

const { verifyPermission, verifyPermissionForDepartmentFromRequest } = jest.requireMock("@/lib/rbac/server")
const supabaseServer = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")

const { PUT } = require("@/app/api/admin/scope-entry-kinds/route")

describe("/api/admin/scope-entry-kinds", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("PUT allows admin.system without departments.manage", async () => {
    verifyPermission.mockResolvedValue({ ok: true })
    verifyPermissionForDepartmentFromRequest.mockResolvedValue({ ok: false, status: 403, error: "Access denied" })

    supabaseServer.createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
    })

    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "d6cdcc71-e732-4ed9-8914-1383df3612f0",
              department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
              entry_kind: "standard",
              label: "NEW",
              sort_order: 0,
              is_default: true,
              is_active: true,
            },
            error: null,
          }),
        }),
      }),
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") return { update }
      throw new Error(`Unexpected table ${table}`)
    })

    const req: any = {
      url: "http://localhost/api/admin/scope-entry-kinds",
      json: async () => ({
        departmentId: "beb111c3-b4e4-44af-b76d-f36935e40272",
        departmentProfessionId: null,
        configs: [
          {
            id: "d6cdcc71-e732-4ed9-8914-1383df3612f0",
            entry_kind: "standard",
            label: "NEW",
            description: "Default report type for general entries",
            sort_order: 0,
            is_default: true,
            is_active: true,
            supports_assigned_agent: false,
            allow_multiple_per_day: false,
            color: "#6B7280",
            icon: "FileText",
          },
        ],
      }),
    }

    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(verifyPermission).toHaveBeenCalledWith("admin.system")
    expect(verifyPermissionForDepartmentFromRequest).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})

