jest.mock("@/lib/supabase-client", () => {
  const single = jest.fn()
  const select = jest.fn(() => ({ single }))
  const insert = jest.fn(() => ({ select }))
  const from = jest.fn(() => ({ insert }))

  return {
    supabase: { from },
    __mocks: { from, insert, select, single },
  }
})

jest.mock("uuid", () => ({
  v4: jest.fn(() => "generated-entry-id"),
}))

const supabaseClientModule = jest.requireMock("@/lib/supabase-client")
const { createEntry } = require("@/lib/supabase-data")

describe("createEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("maps the legacy standard unique index violation to a helpful message", async () => {
    supabaseClientModule.__mocks.single.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "captain_log_entries_standard_unique"',
        details: 'Key (submitted_by_user_id, subject_department_id, date) already exists.',
        hint: null,
      },
    })

    await expect(
      createEntry({
        user_id: "user-1",
        submitted_by_user_id: "user-1",
        date: "2026-04-08",
        department_id: "dept-1",
        subject_department_id: "dept-1",
        entry_kind: "standard",
      })
    ).rejects.toMatchObject({
      name: "SupabaseDataError",
      code: "duplicate",
      message:
        "A standard report already exists for this department and date. If this report type should allow multiple submissions per day, apply the latest database migration for scope-aware entry availability.",
    })
  })
})
