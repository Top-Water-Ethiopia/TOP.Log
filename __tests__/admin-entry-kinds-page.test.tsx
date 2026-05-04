import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import EntryKindsConfigPage from "@/app/admin/settings/entry-kinds/page"
import { useScopeEntryKindsV2 } from "@/hooks/use-entry-kinds"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

const toastFn = jest.fn()
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastFn }),
}))

// Replace Radix Switch with a native checkbox to make toggles testable
jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input
      data-testid="mock-switch"
      type="checkbox"
      id={id}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

// Replace Radix Select with a native <select> to make testing deterministic
jest.mock("@/components/ui/select", () => {
  function flattenItems(children: any): Array<{ value: string; label: string }> {
    const items: Array<{ value: string; label: string }> = []
    const visit = (node: any) => {
      if (!node) return
      if (Array.isArray(node)) return node.forEach(visit)
      if (typeof node !== "object") return
      if (node?.type?.displayName === "SelectItem" || node?.type?.name === "SelectItem") {
        const value = String(node.props.value ?? "")
        const label =
          typeof node.props.children === "string"
            ? node.props.children
            : Array.isArray(node.props.children)
              ? node.props.children.filter((c: any) => typeof c === "string").join(" ")
              : "option"
        items.push({ value, label })
      }
      if (node.props?.children) visit(node.props.children)
    }
    visit(children)
    return items
  }

  const Select = ({ value, onValueChange, children, disabled }: any) => {
    const items = flattenItems(children)
    return (
      <select
        data-testid="mock-select"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="" />
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
    )
  }

  const SelectTrigger = ({ children }: any) => <>{children}</>
  const SelectValue = () => null
  const SelectContent = ({ children }: any) => <>{children}</>
  const SelectItem = ({ children }: any) => <>{children}</>
  SelectItem.displayName = "SelectItem"

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

jest.mock("@/hooks/use-entry-kinds", () => ({
  useScopeEntryKindsV2: jest.fn(),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe("/admin/settings/entry-kinds", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(useScopeEntryKindsV2 as jest.Mock).mockReset()
    ;(useScopeEntryKindsV2 as jest.Mock).mockImplementation((departmentId: string | null) => ({
      // Mirror real behavior: no department selected => no configs
      entryKinds:
        departmentId == null
          ? []
          : [
              {
                id: "k1",
                department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
                department_profession_id: null,
                entry_kind: "standard",
                label: "Standard",
                description: null,
                sort_order: 0,
                is_default: true,
                is_active: true,
                supports_assigned_agent: false,
                allow_multiple_per_day: false,
                color: "#6B7280",
                icon: "FileText",
                created_by: null,
                updated_by: null,
                created_at: "",
                updated_at: "",
              },
            ],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      scope: "department",
      selfHealed: false,
    }))

    mockFetch.mockImplementation((url: any, init?: any) => {
      if (typeof url === "string" && url === "/api/admin/departments") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: "beb111c3-b4e4-44af-b76d-f36935e40272", name: "Sales", description: null }],
          }),
        })
      }

      if (typeof url === "string" && url.includes("/profession-roles")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "role-sales-promoter",
                name: "sales-promoter",
                display_name: "Sales Promoter",
                department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
                is_active: true,
              },
            ],
          }),
        })
      }

      if (typeof url === "string" && url === "/api/admin/scope-entry-kinds" && init?.method === "PUT") {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
      }

      if (typeof url === "string" && url === "/api/admin/scope-entry-kinds" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { id: "new-kind", entry_kind: "new_kind", label: "New Kind" } }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    })
  })

  it("filters config mode: hides Personal Scope when system is dept_report", async () => {
    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    // Select department via mocked select (first select in the page)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })
    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[0]).toHaveValue("beb111c3-b4e4-44af-b76d-f36935e40272")
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })

    // System select (second select)
    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "dept_report")

    expect(screen.queryByText("Personal Scope")).toBeNull()
    expect(screen.getByText(/Department reporting uses department-report entry kinds only/i)).toBeInTheDocument()
  })

  it("PUT save includes scopeType and omits professionRoleId for dept_report", async () => {
    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })
    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[0]).toHaveValue("beb111c3-b4e4-44af-b76d-f36935e40272")
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })

    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "dept_report")

    await waitFor(() => {
      expect(screen.getByText("Entry Kinds")).toBeInTheDocument()
    })

    // Change label text to create a change (more reliable than Radix Switch in tests)
    const labelInput = await screen.findByDisplayValue("Standard", {}, { timeout: 3000 })
    fireEvent.change(labelInput, { target: { value: "Standard Updated" } })

    const save = screen.getByRole("button", { name: /save changes/i })
    await waitFor(() => expect(save).not.toBeDisabled())
    await user.click(save)

    await waitFor(() => {
      const putCall = mockFetch.mock.calls.find((c) => c[0] === "/api/admin/scope-entry-kinds" && c[1]?.method === "PUT")
      expect(putCall).toBeTruthy()
      const body = JSON.parse(putCall![1].body)
      expect(body.scopeType).toBe("dept_report")
      expect(body.professionRoleId).toBeNull()
      expect(body.departmentId).toBe("beb111c3-b4e4-44af-b76d-f36935e40272")
    })
  })

  it("changing an entry kind label enables the Save Changes button", async () => {
    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })

    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })
    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "personal")

    await waitFor(() => expect(screen.getByText("Entry Kinds")).toBeInTheDocument())

    const save = screen.getByRole("button", { name: /save changes/i })
    expect(save).toBeDisabled()

    const labelInput = await screen.findByDisplayValue("Standard", {}, { timeout: 3000 })
    fireEvent.change(labelInput, { target: { value: "Standard Updated" } })

    await waitFor(() => expect(save).not.toBeDisabled())
  })

  it("POST create uses dept_wide_personal by default in personal mode", async () => {
    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })
    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[0]).toHaveValue("beb111c3-b4e4-44af-b76d-f36935e40272")
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })

    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "personal")

    // Ensure personal scope is dept-wide (default)
    expect(screen.getByText("Personal Scope")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create entry kind/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /create entry kind/i }))
    await screen.findByText(/Create New Entry Kind/i)

    fireEvent.change(screen.getByPlaceholderText("e.g., daily_report"), { target: { value: "new_kind" } })
    fireEvent.change(screen.getByLabelText(/Display Label/i), { target: { value: "New Kind" } })

    const createButtons = screen.getAllByRole("button", { name: /^Create Entry Kind$/i })
    fireEvent.click(createButtons[createButtons.length - 1]!)

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find((c) => c[0] === "/api/admin/scope-entry-kinds" && c[1]?.method === "POST")
      expect(postCall).toBeTruthy()
      const body = JSON.parse(postCall![1].body)
      expect(body.scopeType).toBe("dept_wide_personal")
      expect(body.professionRoleId).toBeNull()
      expect(body.departmentId).toBe("beb111c3-b4e4-44af-b76d-f36935e40272")
    })
  })

  it("deactivating an entry kind and saving sends is_active=false (soft delete)", async () => {
    ;(useScopeEntryKindsV2 as jest.Mock).mockImplementation(() => ({
      entryKinds: [
        {
          id: "k1",
          department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
          department_profession_id: null,
          entry_kind: "standard",
          label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          is_active: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
          color: "#6B7280",
          icon: "FileText",
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
        {
          id: "k2",
          department_id: "beb111c3-b4e4-44af-b76d-f36935e40272",
          department_profession_id: null,
          entry_kind: "call_log",
          label: "Call log",
          description: null,
          sort_order: 1,
          is_default: false,
          is_active: true,
          supports_assigned_agent: false,
          allow_multiple_per_day: false,
          color: "#6B7280",
          icon: "Phone",
          created_by: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        },
      ],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      scope: "department",
      selfHealed: false,
    }))

    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })
    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[0]).toHaveValue("beb111c3-b4e4-44af-b76d-f36935e40272")
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })
    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "personal")

    await waitFor(() => {
      expect(screen.getByText("Entry Kinds")).toBeInTheDocument()
    })

    // Make "call_log" the default before deactivating the current default.
    const defaultCallLog = document.getElementById("default-call_log") as HTMLInputElement
    expect(defaultCallLog).toBeTruthy()
    expect(defaultCallLog.checked).toBe(false)
    fireEvent.click(defaultCallLog)

    const activeToggle = document.getElementById("active-standard") as HTMLInputElement
    expect(activeToggle).toBeTruthy()
    expect(activeToggle.checked).toBe(true)

    // Toggle off (deactivate)
    fireEvent.click(activeToggle)

    const save = screen.getByRole("button", { name: /save changes/i })
    await waitFor(() => expect(save).not.toBeDisabled())
    await user.click(save)

    await waitFor(() => {
      const putCall = mockFetch.mock.calls.find((c) => c[0] === "/api/admin/scope-entry-kinds" && c[1]?.method === "PUT")
      expect(putCall).toBeTruthy()
      const body = JSON.parse(putCall![1].body)
      expect(body.scopeType).toBe("dept_wide_personal")
      expect(body.professionRoleId).toBeNull()
      expect(body.configs?.[0]?.is_active).toBe(false)
    })
  })

  it("profession scope selection uses profession_personal and includes professionRoleId in PUT", async () => {
    render(<EntryKindsConfigPage />)
    const user = userEvent.setup()

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/departments", expect.anything()))
    await waitFor(() => {
      const deptSelect = screen.getAllByTestId("mock-select")[0] as HTMLSelectElement
      expect(deptSelect.querySelector('option[value="beb111c3-b4e4-44af-b76d-f36935e40272"]')).toBeTruthy()
    })
    await user.selectOptions(
      screen.getAllByTestId("mock-select")[0] as HTMLSelectElement,
      "beb111c3-b4e4-44af-b76d-f36935e40272"
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[0]).toHaveValue("beb111c3-b4e4-44af-b76d-f36935e40272")
      expect(screen.getAllByTestId("mock-select")[1]).not.toBeDisabled()
    })

    // Personal system + profession scope
    await user.selectOptions(screen.getAllByTestId("mock-select")[1] as HTMLSelectElement, "personal")
    await waitFor(() => expect(screen.getByText("Personal Scope")).toBeInTheDocument())

    // third select should be the Personal Scope select in our mocked Select implementation
    await waitFor(() => {
      expect(screen.getAllByTestId("mock-select")[2]).not.toBeDisabled()
    })
    await user.selectOptions(screen.getAllByTestId("mock-select")[2] as HTMLSelectElement, "role-sales-promoter")

    // Trigger a change and save
    const labelInput = await screen.findByDisplayValue("Standard", {}, { timeout: 3000 })
    fireEvent.change(labelInput, { target: { value: "Standard for Promoters" } })

    const save = screen.getByRole("button", { name: /save changes/i })
    await waitFor(() => expect(save).not.toBeDisabled())
    await user.click(save)

    await waitFor(() => {
      const putCall = mockFetch.mock.calls.find((c) => c[0] === "/api/admin/scope-entry-kinds" && c[1]?.method === "PUT")
      expect(putCall).toBeTruthy()
      const body = JSON.parse(putCall![1].body)
      expect(body.scopeType).toBe("profession_personal")
      expect(body.professionRoleId).toBe("role-sales-promoter")
      expect(body.departmentId).toBe("beb111c3-b4e4-44af-b76d-f36935e40272")
    })
  })
})
