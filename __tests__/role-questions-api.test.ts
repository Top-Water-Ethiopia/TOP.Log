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

const mockCreateClient = jest.fn()
const mockUserCanAnswerDepartmentQuestions = jest.fn()

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

jest.mock("@/lib/server/department-reporting", () => ({
  userCanAnswerDepartmentQuestions: (...args: unknown[]) => mockUserCanAnswerDepartmentQuestions(...args),
}))

const routeModule = require("@/app/api/role-questions/route")

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("/api/role-questions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)
  })

  it("returns profession-scoped questions when role matches legacy department_role key", async () => {
    const userProfilesBuilder = createThenableBuilder({
      data: {
        role_id: "regular-role",
        department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
      },
      error: null,
    })

    const roleQuestionsBuilder = createThenableBuilder({
      data: [
        {
          id: "question-1",
          department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
          department_profession_id: "eb4bb51e-f49f-4990-9629-a1fc7a8e4819",
          department_role: "sales-promoter",
          entry_kind: "standard",
          question_label: "Agent Report",
          question_type: "text",
          question_description: null,
          placeholder: null,
          options: null,
          is_required: true,
          display_order: 0,
          validation_rules: null,
          is_active: true,
          created_at: "2026-04-09T00:00:00.000Z",
          updated_at: "2026-04-09T00:00:00.000Z",
          metadata: { legacy_question_key: "agent_report" },
          department_profession: null,
        },
      ],
      error: null,
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_profiles") return userProfilesBuilder
        if (table === "role_questions") return roleQuestionsBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await routeModule.GET({
      url: "http://localhost/api/role-questions?forReport=true&departmentId=beb111c3-b4e4-44af-b76d-f36935e40272&role=sales-promoter",
    } as Request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        id: "question-1",
        department_role: "sales-promoter",
        question_key: "agent_report",
      }),
    ])
  })
})
