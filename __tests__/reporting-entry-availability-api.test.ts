jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status ?? 200,
      async json() {
        return body
      },
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const { createClient } = jest.requireMock("@/lib/supabase/server")
const routeModule = require("@/app/api/reporting/entry-availability/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/reporting/entry-availability", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("returns an existing standard entry id when one already exists for the user, department, and date", async () => {
    const professionBuilder = createThenableBuilder({
      data: { department_id: "dept-1" },
      error: null,
    })
    const accessBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindBuilder = createThenableBuilder({
      data: { allow_multiple_per_day: false },
      error: null,
    })
    const entryBuilder = createThenableBuilder({
      data: { id: "entry-1" },
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") return professionBuilder
        if (table === "user_department_access_levels") return accessBuilder
        if (table === "scope_entry_kinds") return scopeEntryKindBuilder
        if (table === "captain_log_entries") return entryBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/entry-availability?departmentId=dept-1&date=2026-04-03",
    } as Request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        existingEntryId: "entry-1",
        existingStandardEntryId: "entry-1",
        allowMultiplePerDay: false,
      },
    })
  })

  it("allows multiple per day when the entry kind is configured as recurring", async () => {
    const professionBuilder = createThenableBuilder({
      data: { department_id: "dept-1" },
      error: null,
    })
    const accessBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindBuilder = createThenableBuilder({
      data: { allow_multiple_per_day: true },
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") return professionBuilder
        if (table === "user_department_access_levels") return accessBuilder
        if (table === "scope_entry_kinds") return scopeEntryKindBuilder
        if (table === "captain_log_entries") {
          throw new Error("captain_log_entries should not be queried for recurring kinds")
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/entry-availability?departmentId=dept-1&date=2026-04-03&entryKind=major_activity&role=sales-promoter",
    } as Request)

    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("entry_kind", "major_activity")
    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("department_profession_id", "sales-promoter")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        existingEntryId: null,
        existingStandardEntryId: null,
        allowMultiplePerDay: true,
      },
    })
  })

  it("allows multiple per day for a recurring standard entry kind", async () => {
    const professionBuilder = createThenableBuilder({
      data: { department_id: "dept-1" },
      error: null,
    })
    const accessBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindBuilder = createThenableBuilder({
      data: { allow_multiple_per_day: true },
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") return professionBuilder
        if (table === "user_department_access_levels") return accessBuilder
        if (table === "scope_entry_kinds") return scopeEntryKindBuilder
        if (table === "captain_log_entries") {
          throw new Error("captain_log_entries should not be queried for recurring standard kinds")
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/entry-availability?departmentId=dept-1&date=2026-04-03&entryKind=standard&role=sales-promoter",
    } as Request)

    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("entry_kind", "standard")
    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("department_profession_id", "sales-promoter")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        existingEntryId: null,
        existingStandardEntryId: null,
        allowMultiplePerDay: true,
      },
    })
  })

  it("blocks a second same-day standard entry when allow_multiple_per_day is false", async () => {
    const professionBuilder = createThenableBuilder({
      data: { department_id: "dept-1" },
      error: null,
    })
    const accessBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindBuilder = createThenableBuilder({
      data: { allow_multiple_per_day: false },
      error: null,
    })
    const entryBuilder = createThenableBuilder({
      data: { id: "entry-2" },
      error: null,
    })

    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") return professionBuilder
        if (table === "user_department_access_levels") return accessBuilder
        if (table === "scope_entry_kinds") return scopeEntryKindBuilder
        if (table === "captain_log_entries") return entryBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/entry-availability?departmentId=dept-1&date=2026-04-03&entryKind=standard&role=sales-promoter",
    } as Request)

    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("entry_kind", "standard")
    expect(scopeEntryKindBuilder.eq).toHaveBeenCalledWith("department_profession_id", "sales-promoter")
    expect(entryBuilder.eq).toHaveBeenCalledWith("submitted_by_user_id", "user-1")
    expect(entryBuilder.eq).toHaveBeenCalledWith("entry_kind", "standard")
    expect(entryBuilder.eq).toHaveBeenCalledWith("subject_department_id", "dept-1")
    expect(entryBuilder.eq).toHaveBeenCalledWith("date", "2026-04-03")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        existingEntryId: "entry-2",
        existingStandardEntryId: "entry-2",
        allowMultiplePerDay: false,
      },
    })
  })

  it("rejects users who do not have access to the requested department", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") {
          return createThenableBuilder({
            data: null,
            error: null,
          })
        }
        if (table === "user_department_access_levels") {
          return createThenableBuilder({
            data: [],
            error: null,
          })
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/reporting/entry-availability?departmentId=dept-1&date=2026-04-03",
    } as Request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "You do not have access to that department",
    })
  })
})
