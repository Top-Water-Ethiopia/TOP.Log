const authGetUserMock = jest.fn()
const maybeSingleMock = jest.fn()
const selectMembershipsMock = jest.fn()
const deleteInMock = jest.fn()
const auditInsertMock = jest.fn()

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: authGetUserMock,
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  })),
}))

jest.mock("@/lib/supabase/admin", () => ({
  adminSupabase: {
    from: jest.fn((table: string) => {
      if (table === "user_department_memberships") {
        return {
          select: (..._args: unknown[]) => ({
            eq: (column: string, value: string) => {
              if (column === "department_id") {
                return {
                  eq: (nextColumn: string, nextValue: string) => {
                    if (nextColumn === "user_id") {
                      return Promise.resolve(selectMembershipsMock(value, nextValue))
                    }
                    return Promise.resolve({ data: null, error: null })
                  },
                }
              }

              return {
                eq: () => Promise.resolve({ data: null, error: null }),
              }
            },
          }),
          delete: () => ({
            in: (...args: unknown[]) => Promise.resolve(deleteInMock(...args)),
          }),
          update: jest.fn(),
        }
      }

      if (table === "membership_audit_log") {
        return {
          insert: (...args: unknown[]) => Promise.resolve(auditInsertMock(...args)),
        }
      }

      return {
        select: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      }
    }),
  },
}))

describe("/api/admin/departments/[departmentId]/memberships/[userId] DELETE", () => {
  beforeEach(() => {
    jest.resetModules()
    authGetUserMock.mockReset()
    maybeSingleMock.mockReset()
    selectMembershipsMock.mockReset()
    deleteInMock.mockReset()
    auditInsertMock.mockReset()

    authGetUserMock.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    })

    const profileSingle = jest.fn().mockResolvedValue({
      data: { role_id: "00000000-0000-0000-0000-000000000001" },
      error: null,
    })

    const createClient = require("@/lib/supabase/server").createClient
    createClient.mockResolvedValue({
      auth: {
        getUser: authGetUserMock,
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: profileSingle,
          })),
        })),
      })),
    })

    selectMembershipsMock.mockResolvedValue({
      data: [
        {
          id: "membership-1",
          user_id: "user-1",
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "role-1",
          is_active: true,
          is_primary: false,
        },
      ],
      error: null,
    })
    deleteInMock.mockResolvedValue({ error: null })
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it("hard deletes from unified memberships", async () => {
    const routeModule = await import("@/app/api/admin/departments/[departmentId]/memberships/[userId]/route")

    const response = await routeModule.DELETE({ url: "http://localhost/test?mode=hard" } as Request, {
      params: Promise.resolve({ departmentId: "dept-1", userId: "user-1" }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(deleteInMock).toHaveBeenCalledWith("id", ["membership-1"])
    expect(body).toEqual({ data: { deleted: true } })
  })
})
