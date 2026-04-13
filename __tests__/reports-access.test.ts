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
const routeModule = require("@/app/api/reports/[reportId]/route")

const USER_ROLE_ID = "00000000-0000-0000-0000-000000000002"

function makeSupabaseMock(accessLevelName: string | null) {
  const userId = "viewer-1"
  let userProfilesSingleCalls = 0

  const captainLogEntriesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "report-1",
        user_id: "author-1",
        department_id: "dept-1",
        custom_responses: [],
      },
      error: null,
    }),
  }

  const userProfilesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => {
      userProfilesSingleCalls += 1

      if (userProfilesSingleCalls === 1) {
        return { data: { role_id: USER_ROLE_ID }, error: null }
      }

      return { data: { name: "Author One" }, error: null }
    }),
  }

  const departmentAccessMaybeSingle = jest.fn().mockResolvedValue({
    data: accessLevelName ? { access_level: { name: accessLevelName } } : null,
    error: null,
  })
  const departmentAccessDepartmentEq = jest.fn().mockReturnValue({
    maybeSingle: departmentAccessMaybeSingle,
  })
  const departmentAccessUserEq = jest.fn().mockReturnValue({
    eq: departmentAccessDepartmentEq,
  })
  const departmentAccessChain = {
    select: jest.fn().mockReturnValue({
      eq: departmentAccessUserEq,
    }),
  }

  const supabaseMock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "captain_log_entries") return captainLogEntriesChain
      if (table === "user_profiles") return userProfilesChain
      if (table === "user_department_memberships") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: accessLevelName ? { role: { name: accessLevelName } } : null,
            error: null,
          })
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return {
    supabaseMock,
    departmentAccessMaybeSingle,
  }
}

describe("/api/reports/[reportId]", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("allows a department lead to open another user's report in the same department", async () => {
    const { supabaseMock, departmentAccessMaybeSingle } = makeSupabaseMock("department-lead")
    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const res = await routeModule.GET({} as any, { params: Promise.resolve({ reportId: "report-1" }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.id).toBe("report-1")
    expect(body.data.profile).toEqual({ name: "Author One" })
    expect(departmentAccessMaybeSingle).toHaveBeenCalled()
  })

  it("denies a contributor from opening another user's report", async () => {
    const { supabaseMock, departmentAccessMaybeSingle } = makeSupabaseMock("contributor")
    supabaseServer.createClient.mockResolvedValue(supabaseMock)

    const res = await routeModule.GET({} as any, { params: Promise.resolve({ reportId: "report-1" }) })
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.error).toBe("Access denied")
    expect(departmentAccessMaybeSingle).toHaveBeenCalled()
  })
})
