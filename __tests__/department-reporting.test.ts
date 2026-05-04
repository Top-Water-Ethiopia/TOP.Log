import {
  getEffectiveDepartmentRole,
  getUserDepartmentProfessionAssignment,
  userCanAnswerDepartmentQuestions,
  getUserEffectiveDepartmentMemberships,
  type EffectiveDepartmentMembership,
} from "@/lib/server/department-reporting"

function createMaybeSingleChain(result: unknown) {
  return {
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
}

// Helper to create a chainable mock that handles any number of .eq() calls
function createEqChain(finalValue: any) {
  const chain: any = {
    eq: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue(finalValue),
    single: jest.fn().mockResolvedValue(finalValue),
    then: (resolve: any) => resolve(finalValue),
  }
  return chain
}

describe("department reporting helpers", () => {
  it("loads the active profession assignment with id and name as legacy key", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn(() => createEqChain({
              data: {
                role_id: "profession-1",
                role: { id: "profession-1", name: "software-engineer", display_name: "Software Engineer" },
              },
              error: null,
            }))
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(getUserDepartmentProfessionAssignment(supabase, "user-1", "dept-1")).resolves.toEqual({
      professionId: "profession-1",
      professionKey: "software-engineer",
      professionName: "Software Engineer",
    })
  })

  it("returns true when the user's access level is allowed to answer department questions", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn(() => createEqChain({
              data: { 
                role_id: "access-1",
                role: { id: "access-1", name: "lead", display_name: "Lead" }
              },
              error: null,
            }))
          }
        }

        if (table === "role_permissions") {
          return {
            select: jest.fn(() => createEqChain({
              data: { effect: "allow" },
              error: null,
            }))
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(userCanAnswerDepartmentQuestions(supabase, "user-1", "dept-1")).resolves.toBe(true)
  })

  it("returns false when the user has no department access-level assignment", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn(() => createEqChain({
              data: null,
              error: null,
            }))
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(userCanAnswerDepartmentQuestions(supabase, "user-1", "dept-1")).resolves.toBe(false)
  })

  it("returns false when no explicit department question permission row exists", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn(() => createEqChain({
              data: { 
                role_id: "access-1",
                role: { id: "access-1", name: "lead", display_name: "Lead" }
              },
              error: null,
            }))
          }
        }

        if (table === "role_permissions") {
          return {
            select: jest.fn(() => createEqChain({
              data: null,
              error: null,
            }))
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(userCanAnswerDepartmentQuestions(supabase, "user-1", "dept-1")).resolves.toBe(false)
  })

  it("falls back to the department access-level label when no profession assignment exists", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          let membershipType: string | null = null
          const chain: any = {
            eq: jest.fn((field, value) => {
              if (field === "membership_type") membershipType = value
              return chain
            }),
            maybeSingle: jest.fn().mockImplementation(() => {
              if (membershipType === "profession") return Promise.resolve({ data: null, error: null })
              if (membershipType === "access_level") {
                return Promise.resolve({
                  data: {
                    role_id: "access-1",
                    role: { id: "access-1", name: "department-lead", display_name: "Department Lead" }
                  },
                  error: null,
                })
              }
              return Promise.resolve({ data: null, error: null })
            }),
            then: (resolve: any) => resolve(chain.maybeSingle()),
          }
          return { select: jest.fn(() => chain) }
        }

        if (table === "role_permissions") {
          return {
            select: jest.fn(() => createEqChain({
              data: { effect: "allow" },
              error: null,
            }))
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(getEffectiveDepartmentRole(supabase, "user-1", "dept-1")).resolves.toEqual({
      roleType: "access-level",
      roleKey: "department-lead",
      roleName: "Department Lead",
      professionId: null,
      professionKey: null,
      professionName: null,
      accessLevelId: "access-1",
      accessLevelName: "department-lead",
      accessLevelDisplayName: "Department Lead",
      canAnswerDepartmentReports: true,
    })
  })
})

describe("getUserEffectiveDepartmentMemberships", () => {
  function createMockSupabase(
    memberships: Array<{
      department_id: string
      membership_type: "profession" | "access_level"
      role_id: string
      is_active: boolean
      is_primary: boolean
      department: { id: string; name: string; description: string | null; is_active: boolean }
      role: { id: string; name: string; display_name: string | null }
    }>,
    accessLevelPermissions: Array<{ role_id: string; permission_name: string }> = []
  ) {
    return {
      from: jest.fn((table: string) => {
        if (table === "user_department_memberships") {
          return {
            select: jest.fn(() => createEqChain({ data: memberships, error: null }))
          }
        }

        if (table === "role_permissions") {
          let capturedRoleId: string | null = null

          return {
            select: jest.fn((fields: string) => {
              if (fields === "resource, action") {
                return {
                  eq: jest.fn((field: string, value: string) => {
                    if (field === "role_id") capturedRoleId = value
                    return {
                      eq: jest.fn(() => {
                        const perms = capturedRoleId
                          ? accessLevelPermissions
                              .filter((p) => p.role_id === capturedRoleId)
                              .map((p) => {
                                const [resource, action] = p.permission_name.split(".")
                                return { resource, action }
                              })
                          : []
                        return Promise.resolve({ data: perms, error: null })
                      }),
                    }
                  }),
                }
              }

              // Chainable mock for specific permission checks
              const chain: any = {
                eq: jest.fn((field, value) => {
                  if (field === "role_id") capturedRoleId = value
                  return chain
                }),
                limit: jest.fn(() => chain),
                maybeSingle: jest.fn(() => {
                  const isAllowed = capturedRoleId 
                    ? accessLevelPermissions.some(p => p.role_id === capturedRoleId && p.permission_name === "department_questions.answer")
                    : false
                  return Promise.resolve({ data: isAllowed ? { effect: "allow" } : null, error: null })
                })
              }
              return chain
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any
  }

  it("returns profession-only membership with correct roleType and capabilities", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "prof-1",
          is_active: true,
          is_primary: true,
          department: { id: "dept-1", name: "Engineering", description: null, is_active: true },
          role: { id: "prof-1", name: "software-engineer", display_name: "Software Engineer" },
        },
      ]
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<EffectiveDepartmentMembership>>({
      departmentId: "dept-1",
      roleType: "profession",
      roleKey: "software-engineer",
      roleLabel: "Software Engineer",
      canViewReports: true,
      canCreateReports: true,
      canAnswerDepartmentReports: false,
    })
  })

  it("returns access-level-only membership with department_questions.answer permission", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "access_level",
          role_id: "access-1",
          is_active: true,
          is_primary: false,
          department: { id: "dept-1", name: "Sales", description: null, is_active: true },
          role: { id: "access-1", name: "department-lead", display_name: "Department Lead" },
        },
      ],
      [{ role_id: "access-1", permission_name: "department_questions.answer" }]
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<EffectiveDepartmentMembership>>({
      departmentId: "dept-1",
      roleType: "access-level",
      roleKey: "department-lead",
      roleLabel: "Department Lead",
      canViewReports: true, 
      canCreateReports: true,
      canAnswerDepartmentReports: true,
    })
  })

  it("does not return membership for access-level without any core permissions", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "access_level",
          role_id: "access-1",
          is_active: true,
          is_primary: false,
          department: { id: "dept-1", name: "Sales", description: null, is_active: true },
          role: { id: "access-1", name: "viewer", display_name: "Viewer" },
        },
      ],
      [] // No permissions
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")
    expect(result).toHaveLength(0)
  })

  it("merges capabilities when user has both profession and access-level in same department", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "prof-1",
          is_active: true,
          is_primary: true,
          department: { id: "dept-1", name: "Engineering", description: null, is_active: true },
          role: { id: "prof-1", name: "software-engineer", display_name: "Software Engineer" },
        },
        {
          department_id: "dept-1",
          membership_type: "access_level",
          role_id: "access-1",
          is_active: true,
          is_primary: false,
          department: { id: "dept-1", name: "Engineering", description: null, is_active: true },
          role: { id: "access-1", name: "department-lead", display_name: "Department Lead" },
        },
      ],
      [{ role_id: "access-1", permission_name: "department_questions.answer" }]
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")

    expect(result).toHaveLength(1)
    expect(result[0].roleType).toBe("profession")
    expect(result[0].canViewReports).toBe(true) 
    expect(result[0].canCreateReports).toBe(true) 
    expect(result[0].canAnswerDepartmentReports).toBe(true) 
  })

  it("handles multiple departments correctly", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "prof-1",
          is_active: true,
          is_primary: true,
          department: { id: "dept-1", name: "Engineering", description: null, is_active: true },
          role: { id: "prof-1", name: "software-engineer", display_name: "Software Engineer" },
        },
        {
          department_id: "dept-2",
          membership_type: "profession",
          role_id: "prof-2",
          is_active: true,
          is_primary: true,
          department: { id: "dept-2", name: "Sales", description: null, is_active: true },
          role: { id: "prof-2", name: "sales-promoter", display_name: "Sales Promoter" },
        },
        {
          department_id: "dept-3",
          membership_type: "access_level",
          role_id: "access-1",
          is_active: true,
          is_primary: false,
          department: { id: "dept-3", name: "Marketing", description: null, is_active: true },
          role: { id: "access-1", name: "department-lead", display_name: "Department Lead" },
        },
      ],
      [{ role_id: "access-1", permission_name: "department_questions.answer" }]
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")

    expect(result).toHaveLength(3)
  })

  it("handles missing role display_name gracefully", async () => {
    const mockSupabase = createMockSupabase(
      [
        {
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "prof-1",
          is_active: true,
          is_primary: true,
          department: { id: "dept-1", name: "Engineering", description: null, is_active: true },
          role: { id: "prof-1", name: "software-engineer", display_name: null },
        },
      ]
    )

    const result = await getUserEffectiveDepartmentMemberships(mockSupabase, "user-1")

    expect(result).toHaveLength(1)
    expect(result[0].roleLabel).toBe("software-engineer")
  })
})

export {}
