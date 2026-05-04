import { matchesDepartmentRoleFilter } from "@/lib/role-question-filters"

describe("matchesDepartmentRoleFilter", () => {
  const baseQuestion = {
    id: "q-1",
    role_id: null,
    department_id: "dept-1",
    department_profession_id: "profession-uuid-1",
    department_role: "sales-promoter",
    question_key: "status_update",
    question_label: "Status update",
    question_type: "text",
    question_description: null,
    placeholder: null,
    options: null,
    is_required: false,
    display_order: 0,
    validation_rules: null,
    is_active: true,
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:00:00.000Z",
    department_profession: {
      id: "profession-uuid-1",
      key: "sales-promoter",
      label: "Sales Promoter",
    },
  }

  it("matches when the URL contains the profession UUID", () => {
    expect(matchesDepartmentRoleFilter(baseQuestion, "dept-1", "profession-uuid-1")).toBe(true)
  })

  it("matches when the URL contains the profession key", () => {
    expect(matchesDepartmentRoleFilter(baseQuestion, "dept-1", "sales-promoter")).toBe(true)
  })

  it("does not match a different department", () => {
    expect(matchesDepartmentRoleFilter(baseQuestion, "dept-2", "sales-promoter")).toBe(false)
  })
})
