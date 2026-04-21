import {
  getQuestionCategory,
  getRoleQuestionScopeCacheKey,
  isDepartmentReportQuestion,
  matchesProfessionQuestion,
  normalizeReportKind,
  resolveRoleQuestionScope,
} from "@/lib/reporting-model"

describe("reporting model helpers", () => {
  it("resolves department report questions from department-only scope", () => {
    const question = { department_id: "dept-1", department_profession_id: null, department_role: null }

    expect(resolveRoleQuestionScope(question)).toEqual({
      kind: "dept_report",
      departmentId: "dept-1",
    })
    expect(isDepartmentReportQuestion(question)).toBe(true)
    expect(getQuestionCategory(question)).toBe("department_report")
    expect(
      getRoleQuestionScopeCacheKey({
        kind: "dept_report",
        departmentId: "dept-1",
      })
    ).toBe("dept_report:dept-1")
  })

  it("resolves profession questions using the new profession id", () => {
    const question = {
      department_id: "dept-1",
      department_profession_id: "profession-1",
      department_role: "software-engineer",
    }

    expect(resolveRoleQuestionScope(question)).toEqual({
      kind: "profession",
      departmentId: "dept-1",
      departmentProfessionId: "profession-1",
      departmentProfessionKey: "software-engineer",
    })
    expect(getQuestionCategory(question)).toBe("profession_question")
    expect(
      matchesProfessionQuestion(question, "dept-1", {
        professionId: "profession-1",
        professionKey: "different-key",
      })
    ).toBe(true)
  })

  it("falls back to legacy profession keys while migration is in progress", () => {
    const question = {
      department_id: "dept-1",
      department_profession_id: null,
      department_role: "software-engineer",
    }

    expect(
      matchesProfessionQuestion(question, "dept-1", {
        professionId: null,
        professionKey: "software-engineer",
      })
    ).toBe(true)
    expect(
      getRoleQuestionScopeCacheKey({
        kind: "profession",
        departmentId: "dept-1",
        departmentProfessionId: null,
        departmentProfessionKey: "software-engineer",
      })
    ).toBe("profession:dept-1:unknown:software-engineer")
  })

  it("normalizes legacy sales promoter keys to the hyphenated canonical key", () => {
    const question = {
      department_id: "dept-1",
      department_profession_id: null,
      department_role: "sales_promoter",
    }

    expect(resolveRoleQuestionScope(question)).toEqual({
      kind: "profession",
      departmentId: "dept-1",
      departmentProfessionId: null,
      departmentProfessionKey: "sales-promoter",
    })
    expect(
      matchesProfessionQuestion(question, "dept-1", {
        professionId: null,
        professionKey: "sales-promoter",
      })
    ).toBe(true)
  })


  it("normalizes unknown report kinds back to personal", () => {
    expect(normalizeReportKind("department")).toBe("department")
    expect(normalizeReportKind("mixed")).toBe("mixed")
    expect(normalizeReportKind("unexpected")).toBe("personal")
    expect(normalizeReportKind(null)).toBe("personal")
  })
})
