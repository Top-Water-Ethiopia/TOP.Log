import React from "react"
import { render, screen } from "@testing-library/react"

import { UserMenuDropdown } from "@/components/user-menu-dropdown"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

describe("UserMenuDropdown", () => {
  it("does not render when not authenticated", () => {
    render(<UserMenuDropdown isAuthenticated={false} displayLabel="Sam" avatarLabel="S" deferUntilMounted={false} />)
    expect(screen.queryByText("Sam")).toBeNull()
  })

  it("renders display label and avatar label when authenticated", () => {
    render(<UserMenuDropdown isAuthenticated={true} displayLabel="Sam" avatarLabel="S" deferUntilMounted={false} />)
    expect(screen.getByText("Sam")).toBeInTheDocument()
    expect(screen.getByText("S")).toBeInTheDocument()
  })

  it("renders even when display label is generic", () => {
    render(<UserMenuDropdown isAuthenticated={true} displayLabel="User" avatarLabel="U" deferUntilMounted={false} />)
    expect(screen.getByText("User")).toBeInTheDocument()
    expect(screen.getByText("U")).toBeInTheDocument()
  })
})
