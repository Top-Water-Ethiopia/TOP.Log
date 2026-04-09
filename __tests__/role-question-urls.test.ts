import { buildRoleQuestionsApiUrl } from "@/lib/role-question-urls"

describe("buildRoleQuestionsApiUrl", () => {
  it("builds the base admin URL when no department is provided", () => {
    expect(buildRoleQuestionsApiUrl()).toBe("/api/role-questions")
  })

  it("includes the role query for profession-scoped department views", () => {
    expect(
      buildRoleQuestionsApiUrl({
        departmentId: "beb111c3-b4e4-44af-b76d-f36935e40272",
        departmentRole: "sales-promoter",
      })
    ).toBe(
      "/api/role-questions?departmentId=beb111c3-b4e4-44af-b76d-f36935e40272&role=sales-promoter"
    )
  })

  it("includes department_only scope for department-wide views", () => {
    expect(
      buildRoleQuestionsApiUrl({
        departmentId: "dept-1",
        departmentOnly: true,
      })
    ).toBe("/api/role-questions?departmentId=dept-1&scope=department_only")
  })

  it("includes both department_only and role when both are provided", () => {
    expect(
      buildRoleQuestionsApiUrl({
        departmentId: "dept-1",
        departmentOnly: true,
        departmentRole: "sales-promoter",
      })
    ).toBe("/api/role-questions?departmentId=dept-1&scope=department_only&role=sales-promoter")
  })
})
