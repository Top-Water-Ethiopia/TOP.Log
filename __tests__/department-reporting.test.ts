import {
  getUserDepartmentProfessionAssignment,
  userCanAnswerDepartmentQuestions,
} from "@/lib/server/department-reporting"

function createMaybeSingleChain(result: unknown) {
  return {
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
}

describe("department reporting helpers", () => {
  it("loads the active profession assignment with id and legacy key", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { department_role_id: "profession-1", role: "software-engineer" },
      error: null,
    })
    const eqIsActive = jest.fn().mockReturnValue({ maybeSingle })
    const eqDepartment = jest.fn().mockReturnValue({ eq: eqIsActive })
    const eqUser = jest.fn().mockReturnValue({ eq: eqDepartment })
    const select = jest.fn().mockReturnValue({ eq: eqUser })

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_professions") {
          return { select }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(getUserDepartmentProfessionAssignment(supabase, "user-1", "dept-1")).resolves.toEqual({
      professionId: "profession-1",
      professionKey: "software-engineer",
    })
  })

  it("returns true when the user's access level is allowed to answer department questions", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "user_department_access_levels") {
          const maybeSingle = jest.fn().mockResolvedValue({
            data: { access_level_id: "access-1" },
            error: null,
          })
          const eqDepartment = jest.fn().mockReturnValue({ maybeSingle })
          const eqUser = jest.fn().mockReturnValue({ eq: eqDepartment })
          return {
            select: jest.fn().mockReturnValue({ eq: eqUser }),
          }
        }

        if (table === "permission_definitions") {
          const single = jest.fn().mockResolvedValue({
            data: { id: "perm-1" },
            error: null,
          })
          const eqAction = jest.fn().mockReturnValue({ single })
          const eqResource = jest.fn().mockReturnValue({ eq: eqAction })
          return {
            select: jest.fn().mockReturnValue({ eq: eqResource }),
          }
        }

        if (table === "department_access_level_permissions") {
          const maybeSingle = jest.fn().mockResolvedValue({
            data: { effect: "allow" },
            error: null,
          })
          const limit = jest.fn().mockReturnValue({ maybeSingle })
          const eqPermission = jest.fn().mockReturnValue({ limit })
          const eqAccessLevel = jest.fn().mockReturnValue({ eq: eqPermission })
          return {
            select: jest.fn().mockReturnValue({ eq: eqAccessLevel }),
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
        if (table === "user_department_access_levels") {
          const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null,
          })
          const eqDepartment = jest.fn().mockReturnValue({ maybeSingle })
          const eqUser = jest.fn().mockReturnValue({ eq: eqDepartment })
          return {
            select: jest.fn().mockReturnValue({ eq: eqUser }),
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
        if (table === "user_department_access_levels") {
          const maybeSingle = jest.fn().mockResolvedValue({
            data: { access_level_id: "access-1" },
            error: null,
          })
          const eqDepartment = jest.fn().mockReturnValue({ maybeSingle })
          const eqUser = jest.fn().mockReturnValue({ eq: eqDepartment })
          return {
            select: jest.fn().mockReturnValue({ eq: eqUser }),
          }
        }

        if (table === "permission_definitions") {
          const single = jest.fn().mockResolvedValue({
            data: { id: "perm-1" },
            error: null,
          })
          const eqAction = jest.fn().mockReturnValue({ single })
          const eqResource = jest.fn().mockReturnValue({ eq: eqAction })
          return {
            select: jest.fn().mockReturnValue({ eq: eqResource }),
          }
        }

        if (table === "department_access_level_permissions") {
          const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null,
          })
          const limit = jest.fn().mockReturnValue({ maybeSingle })
          const eqPermission = jest.fn().mockReturnValue({ limit })
          const eqAccessLevel = jest.fn().mockReturnValue({ eq: eqPermission })
          return {
            select: jest.fn().mockReturnValue({ eq: eqAccessLevel }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as any

    await expect(userCanAnswerDepartmentQuestions(supabase, "user-1", "dept-1")).resolves.toBe(false)
  })
})

export {}
