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
  verifyPermissionFromRequest: jest.fn(),
}))

jest.mock("@/lib/supabase/admin", () => {
  const mock = { from: jest.fn() }
  return { adminSupabase: mock, __adminMock: mock }
})

const { verifyPermissionFromRequest } = jest.requireMock("@/lib/rbac/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const routeModule = require("@/app/api/admin/departments/[departmentId]/access-control/route")

describe("/api/admin/departments/[departmentId]/access-control", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    verifyPermissionFromRequest.mockResolvedValue({ ok: true, userId: "admin-1" })
  })

  it("GET returns active access levels plus the ones allowed to answer department reports", async () => {
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "permission_definitions") {
        const single = jest.fn().mockResolvedValue({ data: { id: "perm-1" }, error: null })
        const eqAction = jest.fn().mockReturnValue({ single })
        const eqResource = jest.fn().mockReturnValue({ eq: eqAction })
        return { select: jest.fn().mockReturnValue({ eq: eqResource }) }
      }

      if (table === "department_access_levels") {
        const order = jest.fn().mockResolvedValue({
          data: [
            { id: "lvl-1", name: "department-lead", display_name: "Department Lead", level: 80, is_active: true },
            { id: "lvl-2", name: "viewer", display_name: "Viewer", level: 10, is_active: true },
          ],
          error: null,
        })
        const eq = jest.fn().mockReturnValue({ order })
        return { select: jest.fn().mockReturnValue({ eq }) }
      }

      if (table === "department_access_level_permissions") {
        const limit = jest.fn().mockResolvedValue({
          data: [{ access_level_id: "lvl-1" }],
          error: null,
        })
        const eqEffect = jest.fn().mockReturnValue({ limit })
        const eqPermission = jest.fn().mockReturnValue({ eq: eqEffect })
        return { select: jest.fn().mockReturnValue({ eq: eqPermission }) }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.GET({} as any, { params: Promise.resolve({ departmentId: "dept-1" }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.data.allowedAccessLevels).toEqual(["department-lead"])
    expect(body.data.accessLevels).toHaveLength(2)
  })

  it("PUT accepts legacy allowedRoles and rewrites grants using access-level names", async () => {
    const deleteIn = jest.fn().mockResolvedValue({ error: null })
    const insert = jest.fn().mockResolvedValue({ error: null })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "department_access_levels") {
        const eq = jest.fn().mockResolvedValue({
          data: [
            { id: "lvl-lead", name: "department-lead" },
            { id: "lvl-viewer", name: "viewer" },
            { id: "lvl-manager", name: "department-manager" },
          ],
          error: null,
        })
        return { select: jest.fn().mockReturnValue({ eq }) }
      }

      if (table === "permission_definitions") {
        const single = jest.fn().mockResolvedValue({ data: { id: "perm-1" }, error: null })
        const eqAction = jest.fn().mockReturnValue({ single })
        const eqResource = jest.fn().mockReturnValue({ eq: eqAction })
        return { select: jest.fn().mockReturnValue({ eq: eqResource }) }
      }

      if (table === "department_access_level_permissions") {
        const limit = jest.fn().mockResolvedValue({
          data: [
            { id: "row-viewer", access_level_id: "lvl-viewer" },
            { id: "row-manager", access_level_id: "lvl-manager" },
          ],
          error: null,
        })
        const eqEffect = jest.fn().mockReturnValue({ limit })
        const eqPermission = jest.fn().mockReturnValue({ eq: eqEffect })
        const inAccessLevels = jest.fn().mockReturnValue({ eq: eqPermission })

        return {
          select: jest.fn().mockReturnValue({ in: inAccessLevels }),
          delete: jest.fn().mockReturnValue({ in: deleteIn }),
          insert,
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const request = {
      json: async () => ({ allowedRoles: ["lead", "viewer"] }),
    } as any

    const response = await routeModule.PUT(request, { params: Promise.resolve({ departmentId: "dept-1" }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.data.allowedAccessLevels).toEqual(["department-lead", "viewer"])
    expect(deleteIn).toHaveBeenCalledWith("id", ["row-manager"])
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        access_level_id: "lvl-lead",
        permission_definition_id: "perm-1",
        effect: "allow",
        created_by: "admin-1",
        updated_by: "admin-1",
      }),
    ])
  })
})

export {}
