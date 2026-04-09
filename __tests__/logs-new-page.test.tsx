import React from "react"
import { render, screen } from "@testing-library/react"

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

const mockCreateClient = jest.fn()
const mockGetUserDepartmentProfessionAssignment = jest.fn()
const mockUserCanAnswerDepartmentQuestions = jest.fn()

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

jest.mock("@/lib/server/department-reporting", () => ({
  getUserDepartmentProfessionAssignment: (...args: unknown[]) => mockGetUserDepartmentProfessionAssignment(...args),
  userCanAnswerDepartmentQuestions: (...args: unknown[]) => mockUserCanAnswerDepartmentQuestions(...args),
}))

jest.mock("@/app/logs/new/client", () => {
  const React = require("react")

  return {
    EntryFormMultistepClient: (props: unknown) =>
      React.createElement("pre", { "data-testid": "entry-form-client" }, JSON.stringify(props)),
  }
})

const { default: NewLogPage } = require("@/app/logs/new/page")

type Row = Record<string, unknown>

function createQueryBuilder(rows: Row[]) {
  const filters: Array<[string, unknown]> = []

  const getFilteredRows = () =>
    rows.filter((row) => {
      return filters.every(([column, value]) => row[column] === value)
    })

  const builder: {
    select: jest.Mock
    eq: jest.Mock
    order: jest.Mock
    limit: jest.Mock
    maybeSingle: jest.Mock
    single: jest.Mock
    then: Promise<{ data: Row[]; error: null }>["then"]
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    then: undefined as never,
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockImplementation((column: string, value: unknown) => {
    filters.push([column, value])
    return builder
  })
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.maybeSingle.mockImplementation(async () => ({
    data: getFilteredRows()[0] ?? null,
    error: null,
  }))
  builder.single.mockImplementation(async () => ({
    data: getFilteredRows()[0] ?? null,
    error: null,
  }))
  builder.then = (resolve, reject) => Promise.resolve({ data: getFilteredRows(), error: null }).then(resolve, reject)

  return builder
}

function createSupabaseMock({
  userId = "user-1",
  professionAssignments = [],
  accessAssignments = [],
  questionRows = [],
  entryRows = [],
  scopeEntryKinds = [],
}: {
  userId?: string
  professionAssignments?: Row[]
  accessAssignments?: Row[]
  questionRows?: Row[]
  entryRows?: Row[]
  scopeEntryKinds?: Row[]
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "user_department_professions") {
        return createQueryBuilder(professionAssignments)
      }

      if (table === "user_department_access_levels") {
        return createQueryBuilder(accessAssignments)
      }

      if (table === "role_questions") {
        return createQueryBuilder(questionRows)
      }

      if (table === "captain_log_entries") {
        return createQueryBuilder(entryRows)
      }

      if (table === "scope_entry_kinds") {
        return createQueryBuilder(scopeEntryKinds)
      }

      if (table === "user_profiles" || table === "departments") {
        return createQueryBuilder([])
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

function getRenderedClientProps() {
  const content = screen.getByTestId("entry-form-client").textContent || "{}"
  return JSON.parse(content) as {
    departmentId: string
    departmentName: string
    date: string
    initialExistingEntryId: string | null
    initialRoleQuestions: Array<{ id: string }>
    initialQuestionsByKind?: Record<string, Array<{ id: string }>>
    initialAvailableEntryKinds?: Array<{ entry_kind: string; is_default?: boolean }>
    role: string | null
  }
}

function makeQuestion({
  id,
  displayOrder,
  departmentProfessionId = null,
  departmentRole = null,
}: {
  id: string
  displayOrder: number
  departmentProfessionId?: string | null
  departmentRole?: string | null
}): Row {
  return {
    id,
    department_id: "dept-1",
    department_profession_id: departmentProfessionId,
    department_role: departmentRole,
    question_key: `${id}-key`,
    question_label: `Question ${id}`,
    question_type: "text",
    question_description: null,
    placeholder: null,
    options: null,
    is_required: false,
    display_order: displayOrder,
    validation_rules: null,
    is_active: true,
    created_at: "2026-04-03T00:00:00.000Z",
    updated_at: "2026-04-03T00:00:00.000Z",
    metadata: null,
  }
}

describe("/logs/new page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue(null)
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)
  })

  it("allows a contributor with profession assignment to access logs/new page", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "sales-promoter",
            is_active: true,
            department: { id: "dept-1", name: "Sales" },
          },
        ],
        questionRows: [],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "sales-promoter",
    })

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-07" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.departmentId).toBe("dept-1")
    expect(props.departmentName).toBe("Sales")
    expect(props.date).toBe("2026-04-07")
    expect(props.role).toBe("sales-promoter")
  })

  it("shows only profession questions to a contributor without department report permission", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "software-engineer",
            is_active: true,
            department: { id: "dept-1", name: "Engineering" },
          },
        ],
        questionRows: [
          makeQuestion({ id: "department-q", displayOrder: 1 }),
          makeQuestion({
            id: "profession-q",
            displayOrder: 2,
            departmentProfessionId: "profession-1",
            departmentRole: "software-engineer",
          }),
        ],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "software-engineer",
    })
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-02" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.departmentId).toBe("dept-1")
    expect(props.initialRoleQuestions.map((question) => question.id)).toEqual(["profession-q"])
  })

  it("preserves custom entry-kind question groups for the new-log client", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "sales-promoter",
            is_active: true,
            department: { id: "dept-1", name: "Sales" },
          },
        ],
        questionRows: [
          {
            ...makeQuestion({
              id: "major-activity-q",
              displayOrder: 1,
              departmentProfessionId: "profession-1",
              departmentRole: "sales-promoter",
            }),
            entry_kind: "major_activity",
          },
        ],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "sales-promoter",
    })
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-08" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.initialQuestionsByKind?.major_activity?.map((question) => question.id)).toEqual(["major-activity-q"])
  })

  it("prefers the resolved profession assignment over a special membership role token", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "role-assignment-sales-promoter",
            is_active: true,
            department: { id: "dept-1", name: "Sales" },
          },
        ],
        questionRows: [
          makeQuestion({
            id: "profession-q",
            displayOrder: 1,
            departmentProfessionId: "profession-1",
            departmentRole: "sales-promoter",
          }),
        ],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "sales-promoter",
    })
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-08" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.role).toBe("sales-promoter")
    expect(props.initialRoleQuestions.map((question) => question.id)).toEqual(["profession-q"])
  })

  it("shows department and profession questions to an explicitly allowed department lead", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "software-engineer",
            is_active: true,
            department: { id: "dept-1", name: "Engineering" },
          },
        ],
        questionRows: [
          makeQuestion({ id: "department-q", displayOrder: 1 }),
          makeQuestion({
            id: "profession-q",
            displayOrder: 2,
            departmentProfessionId: "profession-1",
            departmentRole: "software-engineer",
          }),
        ],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "software-engineer",
    })
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(true)

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-02" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.initialRoleQuestions.map((question) => question.id)).toEqual(["department-q", "profession-q"])
  })

  it("honors an authorized departmentId when the user has access in that department", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        accessAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-2",
            department: { id: "dept-2", name: "Sales" },
          },
        ],
        questionRows: [],
      })
    )

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-2", date: "2026-04-02" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.departmentId).toBe("dept-2")
    expect(props.departmentName).toBe("Sales")
  })

  it("redirects unauthorized department requests back to the resolved allowed department", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "software-engineer",
            is_active: true,
            department: { id: "dept-1", name: "Engineering" },
          },
        ],
      })
    )

    await expect(
      NewLogPage({
        searchParams: Promise.resolve({ departmentId: "dept-2", date: "2026-04-02" }),
      })
    ).rejects.toThrow("REDIRECT:/logs/new?departmentId=dept-1&date=2026-04-02")

    expect(mockRedirect).toHaveBeenCalledWith("/logs/new?departmentId=dept-1&date=2026-04-02")
  })

  it("canonicalizes the route when departmentId is missing by redirecting to the resolved department and date", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "software-engineer",
            is_active: true,
            department: { id: "dept-1", name: "Engineering" },
          },
        ],
      })
    )

    await expect(
      NewLogPage({
        searchParams: Promise.resolve({ date: "2026-04-02" }),
      })
    ).rejects.toThrow("REDIRECT:/logs/new?departmentId=dept-1&date=2026-04-02")

    expect(mockRedirect).toHaveBeenCalledWith("/logs/new?departmentId=dept-1&date=2026-04-02")
  })

  it("passes the initial existing standard entry id for duplicate standard report dates", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "software-engineer",
            is_active: true,
            department: { id: "dept-1", name: "Engineering" },
          },
        ],
        entryRows: [
          {
            id: "entry-1",
            submitted_by_user_id: "user-1",
            entry_kind: "standard",
            subject_department_id: "dept-1",
            date: "2026-04-02",
          },
        ],
      })
    )

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-02" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.initialExistingEntryId).toBe("entry-1")
  })

  it("uses the configured default entry kind instead of hardcoding standard", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        professionAssignments: [
          {
            user_id: "user-1",
            department_id: "dept-1",
            role: "sales-promoter",
            is_active: true,
            department: { id: "dept-1", name: "Marketing" },
          },
        ],
        questionRows: [
          {
            ...makeQuestion({
              id: "standard-q",
              displayOrder: 2,
              departmentProfessionId: "profession-1",
              departmentRole: "sales-promoter",
            }),
            entry_kind: "standard",
          },
          {
            ...makeQuestion({
              id: "marketing-q",
              displayOrder: 1,
              departmentProfessionId: "profession-1",
              departmentRole: "sales-promoter",
            }),
            entry_kind: "marketing_performance_report",
          },
        ],
        scopeEntryKinds: [
          {
            department_id: "dept-1",
            entry_kind: "standard",
            label: "Agent Report",
            is_default: false,
            is_active: true,
            allow_multiple_per_day: true,
            department_profession_id: "sales-promoter",
          },
          {
            department_id: "dept-1",
            entry_kind: "marketing_performance_report",
            label: "Marketing Performance Report",
            is_default: true,
            is_active: true,
            allow_multiple_per_day: false,
            department_profession_id: "sales-promoter",
          },
        ],
        entryRows: [
          {
            id: "marketing-entry-1",
            submitted_by_user_id: "user-1",
            entry_kind: "marketing_performance_report",
            subject_department_id: "dept-1",
            date: "2026-04-02",
          },
        ],
      })
    )
    mockGetUserDepartmentProfessionAssignment.mockResolvedValue({
      professionId: "profession-1",
      professionKey: "sales-promoter",
    })
    mockUserCanAnswerDepartmentQuestions.mockResolvedValue(false)

    const element = await NewLogPage({
      searchParams: Promise.resolve({ departmentId: "dept-1", date: "2026-04-02" }),
    })

    render(element)

    const props = getRenderedClientProps()
    expect(props.initialAvailableEntryKinds?.map((kind) => kind.entry_kind)).toEqual([
      "standard",
      "marketing_performance_report",
    ])
    expect(props.initialAvailableEntryKinds?.find((kind) => kind.entry_kind === "marketing_performance_report")?.is_default).toBe(
      true
    )
    expect(props.initialExistingEntryId).toBe("marketing-entry-1")
  })
})
