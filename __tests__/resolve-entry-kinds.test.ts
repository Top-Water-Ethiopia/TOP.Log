jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const supabaseServer = jest.requireMock("@/lib/supabase/server")

const { resolveEntryKinds, EntryKindsError } = require("@/lib/entry-kinds/resolve")

function makeSupabaseMock(responders: {
  memberships?: any
  scopeRows?: any[]
}) {
  const from = jest.fn((table: string) => {
    if (table === "user_department_memberships") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: responders.memberships ?? null, error: null }),
      }
    }

    if (table === "scope_entry_kinds") {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
      }
      // Final await happens on the chain itself
      chain.then = undefined
      return new Proxy(chain, {
        get(target, prop) {
          if (prop === "then") {
            return (resolve: any) => resolve({ data: responders.scopeRows ?? [], error: null })
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (target as any)[prop]
        },
      })
    }

    throw new Error(`Unexpected table ${table}`)
  })

  return { from }
}

describe("resolveEntryKinds", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("dept_report hard fails when not configured", async () => {
    supabaseServer.createClient.mockResolvedValue(makeSupabaseMock({ scopeRows: [] }))

    await expect(
      resolveEntryKinds({ system: "dept_report", departmentId: "d1", userId: "u1" })
    ).rejects.toMatchObject({ code: "DEPT_REPORT_NOT_CONFIGURED" })
  })

  it("personal falls back to dept-wide when profession config is empty", async () => {
    supabaseServer.createClient
      // getPrimaryProfessionRoleId
      .mockResolvedValueOnce(makeSupabaseMock({ memberships: { role_id: "p1" } }))
      // profession_personal query returns only inactive rows (empty configuration)
      .mockResolvedValueOnce(
        makeSupabaseMock({
          scopeRows: [{ scope_type: "profession_personal", profession_role_id: "p1", is_active: false, sort_order: 0, label: "A" }],
        })
      )
      // dept_wide_personal query returns active rows
      .mockResolvedValueOnce(
        makeSupabaseMock({
          scopeRows: [{ scope_type: "dept_wide_personal", department_profession_id: null, is_active: true, sort_order: 0, label: "B" }],
        })
      )

    const res = await resolveEntryKinds({ system: "personal", departmentId: "d1", userId: "u1" })
    expect(res.meta.used).toBe("dept_wide_personal")
    expect(res.data).toHaveLength(1)
    expect(res.data[0].label).toBe("B")
  })
})
