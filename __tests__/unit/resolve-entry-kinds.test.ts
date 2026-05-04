import { resolveEntryKinds } from "../../lib/entry-kinds/resolve"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock

describe("resolveEntryKinds - Deterministic Engine", () => {
  const departmentId = "dept-1"
  const userId = "user-1"
  const professionRoleId = "prof-1"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockSupabase(responses: any) {
    const mockFrom = (table: string) => {
      const filters: any[] = []
      
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((col, val) => {
          filters.push({ type: 'eq', col, val })
          return builder
        }),
        is: jest.fn().mockImplementation((col, val) => {
          filters.push({ type: 'is', col, val })
          return builder
        }),
        or: jest.fn().mockImplementation((val) => {
          filters.push({ type: 'or', val })
          return builder
        }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => {
          const data = responses[table]?.maybeSingle?.data || null
          return { data, error: null }
        }),
        then: jest.fn().mockImplementation((resolve) => {
          let data = responses[table]?.list?.data || []
          
          if (table === 'scope_entry_kinds') {
            const isProfQuery = filters.some(f => f.type === 'or' && f.val.includes('profession_role_id'))
            const isDeptQuery = filters.some(f => f.type === 'is' && f.col === 'profession_role_id' && f.val === null)
            
            if (isProfQuery) {
              data = data.filter((r: any) => r.profession_role_id === professionRoleId)
            } else if (isDeptQuery) {
              data = data.filter((r: any) => !r.profession_role_id)
            }
          }

          return Promise.resolve(resolve({ data, error: null }))
        }),
      }
      return builder
    }

    mockCreateClient.mockReturnValue({
      from: mockFrom,
    })
  }

  it("prioritizes profession scope over department scope with versioning", async () => {
    mockSupabase({
      user_department_memberships: {
        maybeSingle: { data: { role_id: professionRoleId }, error: null },
      },
      roles: {
        maybeSingle: { data: { name: "Contr" }, error: null },
      },
      scope_entry_kinds: {
        list: {
          data: [
            {
              id: "scope-1",
              entry_kind: "standard",
              label: "Dept Standard",
              is_active: true,
              is_default: true,
              created_at: "2024-01-01",
              profession_role_id: null,
              versions: [
                { id: "v-dept-1", version: 1, question_sets: [{ id: "qs-dept-1", is_active: true }] }
              ]
            },
            {
              id: "scope-2",
              entry_kind: "standard",
              label: "Prof Standard",
              is_active: true,
              is_default: false,
              created_at: "2024-01-02",
              profession_role_id: professionRoleId,
              versions: [
                { id: "v-prof-1", version: 1, question_sets: [{ id: "qs-prof-1", is_active: true }] }
              ]
            },
          ],
          error: null,
        },
      },
    })

    const result = await resolveEntryKinds({
      system: "personal",
      departmentId,
      userId,
    })

    // Expecting 1 entry (Prof Standard override Dept Standard)
    expect(result.data).toHaveLength(1)
    expect(result.primary.label).toBe("Prof Standard")
    expect(result.meta.resolution?.standard.source).toBe("profession_personal")
    expect(result.meta.resolution?.standard.priority).toBe(3.0)
    expect(result.meta.resolution?.standard.entry_kind_version_id).toBe("v-prof-1")
    expect(result.meta.resolution?.standard.question_set_version_id).toBe("qs-prof-1")
  })

  it("handles empty configurations gracefully", async () => {
    mockSupabase({
      user_department_memberships: {
        maybeSingle: { data: null, error: null },
      },
      scope_entry_kinds: {
        list: { data: [], error: null },
      },
    })

    const result = await resolveEntryKinds({
      system: "personal",
      departmentId,
      userId,
    })

    expect(result.data).toHaveLength(0)
    expect(result.meta.state).toBe("CONFIG_NOT_FOUND")
  })

  it("correctly identifies the computed default", async () => {
    mockSupabase({
      user_department_memberships: { maybeSingle: { data: null, error: null } },
      scope_entry_kinds: {
        list: {
          data: [
            { entry_kind: "b", is_default: false, sort_order: 10, created_at: "2024-01-01", is_active: true, versions: [] },
            { entry_kind: "a", is_default: true, sort_order: 1, created_at: "2024-01-01", is_active: true, versions: [] },
          ],
          error: null,
        },
      },
    })

    const result = await resolveEntryKinds({
      system: "personal",
      departmentId,
      userId,
    })

    expect(result.primary.entry_kind).toBe("a")
    expect(result.data[0].entry_kind).toBe("a")
  })
})
