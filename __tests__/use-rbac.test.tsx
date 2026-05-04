import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useRBAC } from "@/hooks/use-rbac"

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "u1", email: "u1@example.com", user_metadata: {}, created_at: "2020-01-01" },
    profile: { role_name: undefined },
    isLoading: false,
  }),
}))

const { apiFetch } = jest.requireMock("@/lib/api-client")

function Probe({ perms }: { perms: string[] }) {
  const rbac = useRBAC()
  return (
    <div>
      {perms.map((p) => (
        <div key={p} data-testid={`perm-${p}`}>
          {rbac.hasPermission(p) ? "yes" : "no"}
        </div>
      ))}
    </div>
  )
}

describe("useRBAC integration", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("prefers DB permissions from /api/rbac/me when available", async () => {
    apiFetch.mockResolvedValue({ role: { name: "manager" }, permissions: ["users.manage", "entries.read"] })

    render(<Probe perms={["users.manage", "entries.read", "entries.update"]} />)

    await waitFor(() => {
      expect(screen.getByTestId("perm-users.manage")).toHaveTextContent("yes")
      expect(screen.getByTestId("perm-entries.read")).toHaveTextContent("yes")
      expect(screen.getByTestId("perm-entries.update")).toHaveTextContent("no")
    })
  })

  it("falls back to local DEFAULT_ROLES when /api/rbac/me fails", async () => {
    apiFetch.mockRejectedValue(new Error("network error"))

    render(<Probe perms={["entries.read", "users.manage"]} />)

    // Default role from mapSupabaseUserToRbacUser is 'programmer';
    // DEFAULT_ROLES for 'programmer' include entries.read but not users.manage
    await waitFor(() => {
      expect(screen.getByTestId("perm-entries.read")).toHaveTextContent("yes")
      expect(screen.getByTestId("perm-users.manage")).toHaveTextContent("no")
    })
  })
})
