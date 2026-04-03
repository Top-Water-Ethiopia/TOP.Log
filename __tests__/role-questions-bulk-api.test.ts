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

jest.mock("@/lib/supabase/admin", () => {
  const mock = {
    from: jest.fn(),
  }

  return { adminSupabase: mock, __adminMock: mock }
})

const { createClient } = jest.requireMock("@/lib/supabase/server")
const { __adminMock } = jest.requireMock("@/lib/supabase/admin")
const routeModule = require("@/app/api/admin/role-questions/bulk/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/admin/role-questions/bulk", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "admin-1" } },
          error: null,
        }),
      },
    })
  })

  it("rejects assigned-agent questions outside the Marketing sales-promoter scope", async () => {
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "departments") {
        return createThenableBuilder({
          data: [{ id: "dept-1", name: "Engineering" }],
          error: null,
        })
      }

      if (table === "department_professions") {
        return createThenableBuilder({
          data: [{ id: "profession-1", key: "software-engineer" }],
          error: null,
        })
      }

      if (table === "role_questions") {
        return createThenableBuilder({ data: [], error: null })
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.POST({
      json: async () => ({
        questions: [
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "software-engineer",
            question_label: "Agent contacted",
            question_type: "select",
            options: null,
            metadata: {
              option_source: {
                kind: "assigned_agents",
              },
            },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Marketing department"),
        expect.stringContaining("sales-promoter profession"),
      ])
    )
  })

  it("normalizes assigned-agent questions for valid Marketing sales-promoter scopes", async () => {
    const insertBuilder = createThenableBuilder({
      data: [{ id: "question-1" }],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "departments") {
        return createThenableBuilder({
          data: [{ id: "dept-marketing", name: "Marketing" }],
          error: null,
        })
      }

      if (table === "department_professions") {
        return createThenableBuilder({
          data: [{ id: "profession-1", key: "sales_promoter" }],
          error: null,
        })
      }

      if (table === "role_questions") {
        return insertBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.POST({
      json: async () => ({
        questions: [
          {
            department_id: "dept-marketing",
            department_profession_id: "profession-1",
            department_role: "sales_promoter",
            question_label: "Agent contacted",
            question_type: "select",
            options: null,
            is_required: false,
            metadata: {
              option_source: {
                kind: "assigned_agents",
              },
            },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(201)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        department_id: "dept-marketing",
        department_profession_id: "profession-1",
        department_role: "sales-promoter",
        question_type: "select",
        options: null,
        is_required: true,
        metadata: expect.objectContaining({
          legacy_question_key: "agent_contacted",
          option_source: {
            kind: "assigned_agents",
          },
        }),
      }),
    ])
  })
})
