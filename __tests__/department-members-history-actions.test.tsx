import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { DepartmentMembersPanel } from "@/app/admin/departments/[departmentId]/members/page"

const mockToast = jest.fn()
const mockApiFetch = jest.fn()

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
    toast: mockToast,
  }),
}))

jest.mock("@/components/ui/action-menu", () => {
  const React = require("react")

  return {
    ActionMenu: ({ trigger, items }: { trigger: React.ReactElement; items?: Array<{ type: string; label?: React.ReactNode; onSelect?: () => void }> }) => {
      const [open, setOpen] = React.useState(false)

      return (
        <div>
          {React.cloneElement(trigger, {
            onClick: () => setOpen((value: boolean) => !value),
          })}
          {open ? (
            <div>
              {items
                ?.filter((item) => item.type === "item")
                .map((item, index) => (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    onClick={() => {
                      item.onSelect?.()
                      setOpen(false)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      )
    },
  }
})

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}))

jest.mock("swr", () => {
  const React = require("react")

  const membershipResponse = {
    data: [
      {
        id: "membership-1",
        user_id: "user-1",
        department_id: "dept-1",
        membership_type: "profession",
        role_id: "role-1",
        is_active: true,
        is_primary: false,
        created_at: "2026-04-13T08:00:00.000Z",
        updated_at: "2026-04-13T08:00:00.000Z",
        role: {
          id: "role-1",
          type: "profession",
          name: "mobile",
          display_name: "Mobile",
        },
        user: {
          name: "Samuel",
          email: "samuel@example.com",
        },
      },
    ],
  }

  const deptRolesResponse = {
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

  return {
    __esModule: true,
    default: (key: string | null) => {
      const initialData = React.useMemo(() => {
        if (!key) return undefined
        if (key === "/api/admin/department-professions") return deptRolesResponse
        if (key === "/api/admin/departments/dept-1/memberships") return membershipResponse
        return undefined
      }, [key])

      const [data, setData] = React.useState(initialData)

      React.useEffect(() => {
        setData(initialData)
      }, [initialData])

      return {
        data,
        error: undefined,
        isLoading: false,
        mutate: (updater?: unknown) => {
          if (typeof updater === "function") {
            setData((current: unknown) => (updater as (value: unknown) => unknown)(current))
          } else if (updater) {
            setData(updater)
          }
          return Promise.resolve()
        },
      }
    },
  }
})

describe("DepartmentMembersPanel membership actions", () => {
  beforeEach(() => {
    mockToast.mockReset()
    mockApiFetch.mockReset()
    mockApiFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === "/api/admin/department-access-levels") {
        return Promise.resolve({ data: [] })
      }

      if (url === "/api/admin/departments/dept-1/memberships" && options?.method === "PATCH") {
        return Promise.resolve({
          data: {
            id: "membership-1",
            user_id: "user-1",
            department_id: "dept-1",
            membership_type: "profession",
            role_id: "role-1",
            is_active: false,
            is_primary: false,
            created_at: "2026-04-13T08:00:00.000Z",
            updated_at: "2026-04-13T08:10:00.000Z",
            role: {
              id: "role-1",
              type: "profession",
              name: "mobile",
              display_name: "Mobile",
            },
          },
        })
      }

      return Promise.resolve({ data: [] })
    })
  })

  it("switches the action menu from Deactivate to Activate immediately after deactivation", async () => {
    render(<DepartmentMembersPanel departmentId="dept-1" />)

    const samuelRow = screen.getByText("Samuel").closest("tr")
    expect(samuelRow).not.toBeNull()

    const actionButton = within(samuelRow as HTMLElement).getByRole("button")
    fireEvent.click(actionButton)

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }))
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }))

    await waitFor(() => {
      expect(screen.getByText("Inactive")).toBeInTheDocument()
    })

    fireEvent.click(within(screen.getByText("Samuel").closest("tr") as HTMLElement).getByRole("button"))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument()
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/admin/departments/dept-1/memberships",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"membership_id":"membership-1"'),
      })
    )
  })
})
