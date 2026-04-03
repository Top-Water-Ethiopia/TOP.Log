import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import HomeUpdated from "@/app/home-updated"

const mockUseAuth = jest.fn()

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock("@/components/main-layout-updated", () => ({
  MainLayoutUpdated: ({ initialRoleQuestions }: { initialRoleQuestions: unknown[] }) => (
    <div data-testid="main-layout-updated">{JSON.stringify(initialRoleQuestions)}</div>
  ),
}))

describe("HomeUpdated", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the loading skeleton until auth is initialized on the client", () => {
    mockUseAuth.mockReturnValue({ isInitialized: false })

    render(<HomeUpdated initialRoleQuestions={[]} />)

    expect(screen.queryByTestId("main-layout-updated")).not.toBeInTheDocument()
  })

  it("renders the main layout after auth initialization without extra route-level providers", async () => {
    mockUseAuth.mockReturnValue({ isInitialized: true })

    render(<HomeUpdated initialRoleQuestions={[{ id: "q-1" }]} />)

    await waitFor(() => {
      expect(screen.getByTestId("main-layout-updated")).toBeInTheDocument()
    })

    expect(screen.getByTestId("main-layout-updated")).toHaveTextContent('[{"id":"q-1"}]')
  })
})
