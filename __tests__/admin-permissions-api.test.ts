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

const supabaseServerAdmin = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const { GET, PUT } = require("@/app/api/admin/permissions/route")

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"

function makeAdminSupabaseGetMock(rows: any[]) {
  const chain3 = { order: jest.fn().mockResolvedValue({ data: rows, error: null }) }
  const chain2 = { order: jest.fn().mockReturnValue(chain3) }
  const chain1 = { eq: jest.fn().mockReturnValue(chain2) }
  const chain0 = { select: jest.fn().mockReturnValue(chain1) }

  __adminMock.from.mockImplementation((table: string) => {
    if (table === "permissions") return chain0
    throw new Error(`Unexpected table ${table}`)
  })
}

function makeAdminSupabasePutMock(updatedRows: any[]) {
  const deleteEq = jest.fn().mockResolvedValue({ error: null })
  const deleteObj = { eq: deleteEq }

  const insert = jest.fn().mockResolvedValue({ error: null })

  const fetchChain3 = { order: jest.fn().mockResolvedValue({ data: updatedRows, error: null }) }
  const fetchChain2 = { order: jest.fn().mockReturnValue(fetchChain3) }
  const fetchChain1 = { eq: jest.fn().mockReturnValue(fetchChain2) }
  const fetchChain0 = { select: jest.fn().mockReturnValue(fetchChain1) }

  const rolesSingle = jest.fn().mockResolvedValue({ data: { id: "role-1" }, error: null })
  const rolesEq = jest.fn().mockReturnValue({ single: rolesSingle })
  const rolesSelect = jest.fn().mockReturnValue({ eq: rolesEq })

  __adminMock.from.mockImplementation((table: string) => {
    if (table === "permissions") {
      return {
        delete: () => deleteObj,
        insert,
        select: fetchChain0.select,
      }
    }
    if (table === "roles") {
      return {
        select: rolesSelect,
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { deleteEq, insert, fetchChainCalls: { fetchChain0, fetchChain1, fetchChain2, fetchChain3 } }
}

function makeCreateClientMockWithAdmin() {
  const userId = "u1"

  const userProfilesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role_id: ADMIN_ROLE_ID }, error: null }),
  }

  const supabaseMock = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: jest.fn((table: string) => {
      if (table === "user_profiles") return userProfilesChain
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  supabaseServerAdmin.createClient.mockResolvedValue(supabaseMock)
  return supabaseMock
}

describe("/api/admin/permissions", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("GET returns permissions for a role", async () => {
    makeCreateClientMockWithAdmin()
    makeAdminSupabaseGetMock([
      { id: "p1", role_id: "role-1", resource: "entries", action: "read" },
      { id: "p2", role_id: "role-1", resource: "users", action: "manage" },
    ])

    const req: any = { url: "http://localhost/api/admin/permissions?role_id=role-1" }
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).toMatchObject({ resource: "entries", action: "read" })
  })

  it("PUT replaces permissions for a role", async () => {
    makeCreateClientMockWithAdmin()
    const updatedRows = [
      { id: "p3", role_id: "role-1", resource: "entries", action: "read" },
      { id: "p4", role_id: "role-1", resource: "entries", action: "update" },
    ]
    const { deleteEq, insert } = makeAdminSupabasePutMock(updatedRows)

    const req: any = {
      url: "http://localhost/api/admin/permissions",
      json: async () => ({ role_id: "role-1", permissions: ["entries.read", "entries.update"] }),
    }

    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)

    expect(deleteEq).toHaveBeenCalledWith("role_id", "role-1")
    expect(insert).toHaveBeenCalled()
  })
})
