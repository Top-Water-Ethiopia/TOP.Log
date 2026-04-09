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
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    limit: jest.fn(() => builder),
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

  it("rejects assigned-agent questions that do not use the select or multiselect question type", async () => {
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return createThenableBuilder({
          data: [{ entry_kind: "standard", is_active: true, supports_assigned_agent: false }],
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
            question_type: "text",
            entry_kind: "standard",
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
        expect.stringContaining("assigned agent questions must use the Select or Multi-Select question type"),
      ])
    )
  })

  it("preserves assigned-agent questions for entry kinds that support assigned agents", async () => {
    const insertBuilder = createThenableBuilder({
      data: [{ id: "question-1" }],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return createThenableBuilder({
          data: [
            { entry_kind: "agent_call", is_active: true, supports_assigned_agent: true },
            { entry_kind: "daily_summary", is_active: true, supports_assigned_agent: true },
          ],
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
            entry_kind: "daily_summary",
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
        entry_kind: "daily_summary",
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

  it("accepts multiple assigned-agent questions in the same scope and supports multiselect", async () => {
    const insertBuilder = createThenableBuilder({
      data: [{ id: "question-1" }, { id: "question-2" }],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return createThenableBuilder({
          data: [
            { entry_kind: "agent_call", is_active: true, supports_assigned_agent: true },
            { entry_kind: "daily_summary", is_active: true, supports_assigned_agent: true },
          ],
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
            department_role: "sales-promoter",
            question_label: "Primary agent",
            question_type: "select",
            entry_kind: "agent_call",
            options: null,
            metadata: { option_source: { kind: "assigned_agents" } },
          },
          {
            department_id: "dept-marketing",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agents present",
            question_type: "multiselect",
            entry_kind: "daily_summary",
            options: null,
            metadata: { option_source: { kind: "assigned_agents" } },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(201)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        question_label: "Primary agent",
        question_type: "select",
        entry_kind: "agent_call",
      }),
      expect.objectContaining({
        question_label: "Agents present",
        question_type: "multiselect",
        entry_kind: "daily_summary",
      }),
    ])
  })

  it("persists per-field assigned-agent daily limits in metadata", async () => {
    const insertBuilder = createThenableBuilder({
      data: [{ id: "question-1" }],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return createThenableBuilder({
          data: [{ entry_kind: "agent_visit", is_active: true, supports_assigned_agent: true }],
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
            department_role: "sales-promoter",
            question_label: "Primary agent",
            question_type: "select",
            entry_kind: "agent_visit",
            options: null,
            metadata: {
              option_source: {
                kind: "assigned_agents",
                max_logs_per_agent_per_day: 2,
              },
            },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(201)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        metadata: expect.objectContaining({
          option_source: {
            kind: "assigned_agents",
            max_logs_per_agent_per_day: 2,
          },
        }),
      }),
    ])
  })

  it("preserves distinct entry kinds when saving multiple questions in the same scope", async () => {
    const existingQuestionsBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindsBuilder = createThenableBuilder({
      data: [
        { entry_kind: "standard", is_active: true },
        { entry_kind: "agent_call", is_active: true },
        { entry_kind: "daily_summary", is_active: true },
      ],
      error: null,
    })
    const upsertBuilder = createThenableBuilder({
      data: [
        { id: "question-1", entry_kind: "standard" },
        { id: "question-2", entry_kind: "agent_call" },
        { id: "question-3", entry_kind: "daily_summary" },
      ],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return scopeEntryKindsBuilder
      }

      if (table === "role_questions") {
        if (existingQuestionsBuilder.select.mock.calls.length === 0) {
          return existingQuestionsBuilder
        }
        return upsertBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.PUT({
      json: async () => ({
        questions: [
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Standard question",
            question_type: "text",
            entry_kind: "standard",
            metadata: { legacy_question_key: "standard_question" },
          },
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agent call question",
            question_type: "text",
            entry_kind: "AGENT_CALL",
            metadata: { legacy_question_key: "agent_call_question" },
          },
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Daily summary question",
            question_type: "text",
            entry_kind: "daily_summary",
            metadata: { legacy_question_key: "daily_summary_question" },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(200)
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          entry_kind: "standard",
          question_label: "Standard question",
        }),
        expect.objectContaining({
          entry_kind: "agent_call",
          question_label: "Agent call question",
        }),
        expect.objectContaining({
          entry_kind: "daily_summary",
          question_label: "Daily summary question",
        }),
      ]),
      { onConflict: "id" }
    )
  })

  it("allows the same normalized question key across different entry kinds in the same scope", async () => {
    const existingQuestionsBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const scopeEntryKindsBuilder = createThenableBuilder({
      data: [
        { entry_kind: "standard", is_active: true },
        { entry_kind: "agent_call", is_active: true },
      ],
      error: null,
    })
    const upsertBuilder = createThenableBuilder({
      data: [
        { id: "question-1", entry_kind: "standard" },
        { id: "question-2", entry_kind: "agent_call" },
      ],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return scopeEntryKindsBuilder
      }

      if (table === "role_questions") {
        if (existingQuestionsBuilder.select.mock.calls.length === 0) {
          return existingQuestionsBuilder
        }
        return upsertBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.PUT({
      json: async () => ({
        questions: [
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agent Name",
            question_type: "text",
            entry_kind: "standard",
            metadata: { legacy_question_key: "agent_name" },
          },
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agent Name",
            question_type: "text",
            entry_kind: "agent_call",
            metadata: { legacy_question_key: "agent_name" },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(200)
    expect(upsertBuilder.upsert).toHaveBeenCalled()
  })

  it("still rejects duplicate question keys within the same entry kind", async () => {
    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return createThenableBuilder({
          data: [{ entry_kind: "standard", is_active: true }],
          error: null,
        })
      }

      if (table === "role_questions") {
        return createThenableBuilder({ data: [], error: null })
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.PUT({
      json: async () => ({
        questions: [
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agent Name",
            question_type: "text",
            entry_kind: "standard",
            metadata: { legacy_question_key: "agent_name" },
          },
          {
            department_id: "dept-1",
            department_profession_id: "profession-1",
            department_role: "sales-promoter",
            question_label: "Agent Name",
            question_type: "text",
            entry_kind: "standard",
            metadata: { legacy_question_key: "agent_name" },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining('Duplicate question key "agent_name"')]))
  })

  it("validates profession entry kinds using the profession key scope while saving the UUID", async () => {
    const scopeEntryKindsBuilder = createThenableBuilder({
      data: [{ entry_kind: "major_activity", is_active: true }],
      error: null,
    })
    const existingQuestionsBuilder = createThenableBuilder({
      data: [],
      error: null,
    })
    const upsertBuilder = createThenableBuilder({
      data: [{ id: "question-1", entry_kind: "major_activity" }],
      error: null,
    })

    __adminMock.from.mockImplementation((table: string) => {
      if (table === "scope_entry_kinds") {
        return scopeEntryKindsBuilder
      }

      if (table === "role_questions") {
        if (existingQuestionsBuilder.select.mock.calls.length === 0) {
          return existingQuestionsBuilder
        }
        return upsertBuilder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const response = await routeModule.PUT({
      json: async () => ({
        questions: [
          {
            department_id: "dept-1",
            department_profession_id: "profession-uuid-1",
            department_role: "sales-promoter",
            question_label: "Major activity notes",
            question_type: "text",
            entry_kind: "major_activity",
            metadata: { legacy_question_key: "major_activity_notes" },
          },
        ],
      }),
    } as any)

    expect(response.status).toBe(200)
    expect(scopeEntryKindsBuilder.eq).toHaveBeenCalledWith("department_profession_id", "sales-promoter")
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          department_profession_id: "profession-uuid-1",
          department_role: "sales-promoter",
          entry_kind: "major_activity",
        }),
      ]),
      { onConflict: "id" }
    )
  })
})
