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
}))

jest.mock("@/lib/supabase/admin", () => {
  const mock = {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        getUserById: jest.fn(),
        listUsers: jest.fn(),
        updateUserById: jest.fn(),
      },
    },
  }

  return { adminSupabase: mock, __adminMock: mock }
})

const { verifyPermission } = jest.requireMock("@/lib/rbac/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const routeModule = require("@/app/api/admin/users/route")

function makeInsertProfileMock(profile: any) {
  const single = jest.fn().mockResolvedValue({ data: profile, error: null })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })

  __adminMock.from.mockImplementation((table: string) => {
    if (table === "user_profiles") {
      return { insert }
    }

    throw new Error(`Unexpected table ${table}`)
  })

  return { insert, select, single }
}

function makeUpdateProfileMock(profile: any) {
  const targetSingle = jest.fn().mockResolvedValue({ data: { role_id: "role-1" }, error: null })
  const targetEq = jest.fn().mockReturnValue({ single: targetSingle })
  const targetSelect = jest.fn().mockReturnValue({ eq: targetEq })

  const updatedSingle = jest.fn().mockResolvedValue({ data: profile, error: null })
  const updatedSelect = jest.fn().mockReturnValue({ single: updatedSingle })
  const updatedEq = jest.fn().mockReturnValue({ select: updatedSelect })
  const update = jest.fn().mockReturnValue({ eq: updatedEq })

  __adminMock.from.mockImplementation((table: string) => {
    if (table === "user_profiles") {
      return {
        select: targetSelect,
        update,
      }
    }

    throw new Error(`Unexpected table ${table}`)
  })

  return { update, updatedEq }
}

describe("/api/admin/users", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    verifyPermission.mockResolvedValue({ ok: true, userId: "admin-1" })
  })

  it("POST creates a user with both email and phone", async () => {
    const profile = {
      id: "profile-1",
      user_id: "user-1",
      name: "Test User",
      department_id: null,
      role_id: "00000000-0000-0000-0000-000000000002",
      is_active: true,
      created_at: "2026-04-03T00:00:00.000Z",
    }

    const { insert } = makeInsertProfileMock(profile)

    __adminMock.auth.admin.createUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          phone: "+251912345678",
          created_at: "2026-04-03T00:00:00.000Z",
        },
      },
      error: null,
    })

    const req: any = {
      json: async () => ({
        email: "User@Example.com",
        phone: "0912345678",
        password: "secret123",
        name: "Test User",
      }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(__adminMock.auth.admin.createUser).toHaveBeenCalledWith({
      email: "user@example.com",
      email_confirm: true,
      phone: "+251912345678",
      phone_confirm: true,
      password: "secret123",
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        name: "Test User",
        phone_e164: "+251912345678",
      })
    )
    expect(body.user).toMatchObject({
      email: "user@example.com",
      phone: "+251912345678",
      identifier: "user@example.com",
    })
  })

  it("POST rejects invalid phone numbers", async () => {
    const req: any = {
      json: async () => ({
        phone: "0712345678",
        password: "secret123",
        name: "Invalid Phone",
      }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()

    expect(body.error).toBe("At least one of email or phone number is required, along with password and name")
    expect(__adminMock.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it("PUT keeps the existing email and adds a normalized phone number", async () => {
    const profile = {
      id: "profile-1",
      user_id: "user-1",
      name: "Updated User",
      department_id: null,
      role_id: "role-1",
      is_active: true,
      created_at: "2026-04-03T00:00:00.000Z",
      last_login: null,
      roles: { id: "role-1", name: "user", description: null },
    }

    const { update } = makeUpdateProfileMock(profile)

    __adminMock.auth.admin.getUserById
      .mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "user@example.com",
            phone: null,
            created_at: "2026-04-03T00:00:00.000Z",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "user@example.com",
            phone: "+251912345678",
            created_at: "2026-04-03T00:00:00.000Z",
          },
        },
        error: null,
      })

    __adminMock.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "user-1", email: "user@example.com", phone: null },
          { id: "user-2", email: "other@example.com", phone: "+251955555555" },
        ],
      },
      error: null,
    })

    __adminMock.auth.admin.updateUserById.mockResolvedValue({ error: null })

    const req: any = {
      json: async () => ({
        user_id: "user-1",
        name: "Updated User",
        phone: "0912345678",
      }),
    }

    const res = await routeModule.PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(__adminMock.auth.admin.updateUserById).toHaveBeenCalledWith("user-1", {
      phone: "+251912345678",
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated User",
        phone_e164: "+251912345678",
      })
    )
    expect(body.user).toMatchObject({
      email: "user@example.com",
      phone: "+251912345678",
      identifier: "user@example.com",
    })
  })

  it("PUT rejects removing both login identifiers", async () => {
    makeUpdateProfileMock({
      id: "profile-1",
      user_id: "user-1",
      name: "Updated User",
      department_id: null,
      role_id: "role-1",
      is_active: true,
      created_at: "2026-04-03T00:00:00.000Z",
      last_login: null,
      roles: { id: "role-1", name: "user", description: null },
    })

    __adminMock.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          phone: "+251912345678",
          created_at: "2026-04-03T00:00:00.000Z",
        },
      },
      error: null,
    })

    const req: any = {
      json: async () => ({
        user_id: "user-1",
        email: "",
        phone: "",
      }),
    }

    const res = await routeModule.PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()

    expect(body.error).toBe("At least one of email or phone number is required")
    expect(__adminMock.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
})

export {}
