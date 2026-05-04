import { resetRoleQuestionScope } from "@/lib/dev/reset-role-question-scope"

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }

  return builder
}

describe("resetRoleQuestionScope", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = "test"
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it("deletes scope questions and entry kinds before reseeding the requested configs", async () => {
    const questionSelectBuilder = createThenableBuilder({
      data: [{ id: "question-1" }, { id: "question-2" }],
      error: null,
    })
    const questionDeleteBuilder = createThenableBuilder({ error: null })
    const entryKindSelectBuilder = createThenableBuilder({
      data: [{ id: "kind-1" }],
      error: null,
    })
    const entryKindDeleteBuilder = createThenableBuilder({ error: null })
    const entryKindInsertBuilder = createThenableBuilder({ error: null })

    const adminClient = {
      from: jest.fn((table: string) => {
        if (table === "role_questions") {
          if (questionSelectBuilder.select.mock.calls.length === 0) return questionSelectBuilder
          return questionDeleteBuilder
        }

        if (table === "scope_entry_kinds") {
          if (entryKindSelectBuilder.select.mock.calls.length === 0) return entryKindSelectBuilder
          if (entryKindDeleteBuilder.delete.mock.calls.length === 0) return entryKindDeleteBuilder
          return entryKindInsertBuilder
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    }

    const result = await resetRoleQuestionScope(adminClient as any, {
      departmentId: "dept-1",
      departmentRoleKey: "sales-promoter",
      entryKinds: [
        {
          entry_kind: "standard",
          label: "Standard",
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
        },
        {
          entry_kind: "majoractivities",
          label: "Major Activities",
          sort_order: 1,
          is_default: false,
          is_active: true,
          supports_assigned_agent: false,
        },
      ],
    })

    expect(questionDeleteBuilder.in).toHaveBeenCalledWith("id", ["question-1", "question-2"])
    expect(entryKindDeleteBuilder.in).toHaveBeenCalledWith("id", ["kind-1"])
    expect(entryKindInsertBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "standard",
          is_default: true,
        }),
        expect.objectContaining({
          department_id: "dept-1",
          department_profession_id: "sales-promoter",
          entry_kind: "majoractivities",
          is_default: false,
        }),
      ])
    )
    expect(result).toEqual({
      deletedQuestionCount: 2,
      deletedEntryKindCount: 1,
      reseededEntryKindCount: 2,
    })
  })
})
