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
  const mock = {
    auth: {
      admin: {
        updateUserById: jest.fn(),
      },
    },
  }

  return { adminSupabase: mock, __adminMock: mock }
})

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}))

const supabaseServer = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const { createClient: createSupabaseClient } = jest.requireMock("@supabase/supabase-js")
const routeModule = require("@/app/api/admin/users/reset-password/route")

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"

function makeAdminVerifier() {
  const userProfilesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role_id: ADMIN_ROLE_ID }, error: null }),
  }

  const supabaseMock = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
    from: jest.fn((table: string) => {
      if (table === "user_profiles") return userProfilesChain
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  supabaseServer.createClient.mockResolvedValue(supabaseMock)
  return supabaseMock
}

describe("/api/admin/users/reset-password", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    makeAdminVerifier()
  })

  it("requires an email when reset mode is email", async () => {
    const req: any = {
      json: async () => ({
        user_id: "user-1",
        mode: "email",
      }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()

    expect(body.error).toBe("Email is required for email reset mode")
    expect(createSupabaseClient).not.toHaveBeenCalled()
  })

  it("allows direct password reset without an email", async () => {
    __adminMock.auth.admin.updateUserById.mockResolvedValue({ error: null })

    const req: any = {
      json: async () => ({
        user_id: "user-1",
        mode: "direct",
        password: "secret123",
      }),
    }

    const res = await routeModule.POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.message).toBe("Password reset successfully")
    expect(__adminMock.auth.admin.updateUserById).toHaveBeenCalledWith("user-1", {
      password: "secret123",
    })
    expect(createSupabaseClient).not.toHaveBeenCalled()
  })
})

export {}
