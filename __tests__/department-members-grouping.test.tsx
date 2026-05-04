import { render, screen, within } from "@testing-library/react"
import { DepartmentMembersPanel } from "@/app/admin/departments/[departmentId]/members/page"

const defaultDeptRolesResponse = {
  data: [
    {
      key: "mobile",
      label: "Mobile",
      sort_order: 1,
      is_active: true,
      is_default: true,
      default_can_answer_department_questions: true,
    },
  ],
}

let membershipsFixture = {
  data: [
    {
      id: "membership-profession",
      user_id: "user-1",
      department_id: "dept-1",
      membership_type: "profession",
      role_id: "role-profession",
      is_active: true,
      is_primary: true,
      created_at: "2026-04-13T08:00:00.000Z",
      updated_at: "2026-04-13T08:00:00.000Z",
      role: {
        id: "role-profession",
        type: "profession",
        name: "mobile",
        display_name: "Mobile",
      },
      user: {
        name: "Samuel",
        email: "samuel@example.com",
      },
    },
    {
      id: "membership-access",
      user_id: "user-1",
      department_id: "dept-1",
      membership_type: "access_level",
      role_id: "role-access",
      is_active: true,
      is_primary: false,
      created_at: "2026-04-13T08:10:00.000Z",
      updated_at: "2026-04-13T08:10:00.000Z",
      role: {
        id: "role-access",
        type: "access_level",
        name: "department-lead",
        display_name: "Department Lead",
        level: 7,
      },
      user: {
        name: "Samuel",
        email: "samuel@example.com",
      },
    },
  ],
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => "/admin/departments/dept-1",
  useSearchParams: () => ({
    get: () => null,
    toString: () => "",
  }),
  useParams: () => ({ departmentId: "dept-1" }),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "admin-1" },
    profile: { role_id: "00000000-0000-0000-0000-000000000001" },
    isLoading: false,
  }),
}))

jest.mock("@/hooks/use-rbac", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
    rbacChecked: true,
    rbacLoading: false,
  }),
}))

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

jest.mock("@/components/ui/action-menu", () => ({
  ActionMenu: ({ trigger }: { trigger: React.ReactElement }) => trigger,
}))

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: jest.fn(() => Promise.resolve({ data: [] })),
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

jest.mock("swr", () => {
  return {
    __esModule: true,
    default: (key: string | null) => {
      return {
        data:
          key === "/api/admin/department-professions"
            ? defaultDeptRolesResponse
            : key === "/api/admin/departments/dept-1/memberships"
              ? membershipsFixture
              : undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    },
  }
})

describe("DepartmentMembersPanel grouping", () => {
  beforeEach(() => {
    membershipsFixture = {
      data: [
        {
          id: "membership-profession",
          user_id: "user-1",
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "role-profession",
          is_active: true,
          is_primary: true,
          created_at: "2026-04-13T08:00:00.000Z",
          updated_at: "2026-04-13T08:00:00.000Z",
          role: {
            id: "role-profession",
            type: "profession",
            name: "mobile",
            display_name: "Mobile",
          },
          user: {
            name: "Samuel",
            email: "samuel@example.com",
          },
        },
        {
          id: "membership-access",
          user_id: "user-1",
          department_id: "dept-1",
          membership_type: "access_level",
          role_id: "role-access",
          is_active: true,
          is_primary: false,
          created_at: "2026-04-13T08:10:00.000Z",
          updated_at: "2026-04-13T08:10:00.000Z",
          role: {
            id: "role-access",
            type: "access_level",
            name: "department-lead",
            display_name: "Department Lead",
            level: 7,
          },
          user: {
            name: "Samuel",
            email: "samuel@example.com",
          },
        },
      ],
    }
  })

  it("shows a user only once when they have both a profession and an access level", () => {
    render(<DepartmentMembersPanel departmentId="dept-1" />)

    expect(screen.getAllByText("Samuel")).toHaveLength(1)

    const row = screen.getByText("Samuel").closest("tr")
    expect(row).not.toBeNull()

    expect(within(row as HTMLElement).getByText("Mobile")).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText("Department Lead Access")).toBeInTheDocument()
  })

  it("shows a deactivated badge when a user has no active memberships", () => {
    membershipsFixture = {
      data: [
        {
          id: "membership-inactive",
          user_id: "user-2",
          department_id: "dept-1",
          membership_type: "profession",
          role_id: "role-profession",
          is_active: false,
          is_primary: false,
          created_at: "2026-04-13T08:00:00.000Z",
          updated_at: "2026-04-13T08:00:00.000Z",
          role: {
            id: "role-profession",
            type: "profession",
            name: "mobile",
            display_name: "Mobile",
          },
          user: {
            name: "Inactive User",
            email: "inactive@example.com",
          },
        },
      ],
    }

    render(<DepartmentMembersPanel departmentId="dept-1" />)

    const row = screen.getByText("Inactive User").closest("tr")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText("Deactivated")).toBeInTheDocument()
  })
})
