const authGetUserMock = jest.fn()
const profileSingleMock = jest.fn()
const membershipSingleMock = jest.fn()
const updateMock = jest.fn()
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
          single: profileSingleMock,
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
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: membershipSingleMock,
              }),
            }),
          }),
          update: (payload: unknown) => {
            updateMock(payload)
            return {
              eq: () => ({
                select: () => ({
                  single: jest.fn(async () => ({
                    data: { id: "m-1" },
                    error: null,
                  })),
                }),
              }),
            }
          },
        }
      }

      if (table === "membership_audit_log") {
        return {
          insert: (...args: unknown[]) => {
            auditInsertMock(...args)
            return Promise.resolve({ error: null })
          },
        }
      }

      return {}
    }),
  },
}))

describe("PATCH /api/admin/departments/[departmentId]/memberships (deactivate)", () => {
  beforeEach(() => {
    authGetUserMock.mockReset()
    profileSingleMock.mockReset()
    membershipSingleMock.mockReset()
    updateMock.mockReset()
    auditInsertMock.mockReset()

    authGetUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null })
    profileSingleMock.mockResolvedValue({
      data: { role_id: "00000000-0000-0000-0000-000000000001" },
      error: null,
    })
    membershipSingleMock.mockResolvedValue({
      data: {
        id: "m-1",
        user_id: "u-1",
        department_id: "d-1",
        membership_type: "profession",
        role_id: "r-1",
        is_active: true,
        is_primary: true,
        updated_at: "2026-03-29T23:07:58.136+00:00",
      },
      error: null,
    })
  })

  it("clears is_primary when deactivating to satisfy chk_primary_must_be_active", async () => {
    const routeModule = await import("@/app/api/admin/departments/[departmentId]/memberships/route")

    const response = await routeModule.PATCH(
      {
        json: async () => ({
          membership_id: "m-1",
          user_id: "u-1",
          is_active: false,
          last_updated_at: "2026-03-29T23:07:58.136+00:00",
          reason: "Reason....",
        }),
      } as unknown as Request,
      { params: Promise.resolve({ departmentId: "d-1" }) }
    )

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: false,
        is_primary: false,
      })
    )
  })
})
