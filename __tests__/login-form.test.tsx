import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import LoginForm from "@/components/login-form"

const loginMock = jest.fn()
const resetAuthErrorMock = jest.fn()

let authState = {
  login: loginMock,
  isLoading: false,
  error: null as string | null,
  session: null as null | { access_token: string },
  resetAuthError: resetAuthErrorMock,
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "redirect" ? "/reports" : null),
  }),
}))

jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: jest.fn(),
  }),
}))

jest.mock("@/lib/feature-flags/client", () => ({
  isFeatureEnabledClient: (flag: string) => flag === "SELF_SERVICE_AUTH",
}))

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => authState,
}))

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authState = {
      login: loginMock,
      isLoading: false,
      error: null,
      session: null,
      resetAuthError: resetAuthErrorMock,
    }
  })

  it("submits credentials with the redirect target", async () => {
    loginMock.mockResolvedValue(undefined)

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "sam@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("sam@example.com", "secret123", "/reports")
    })
  })

  it("renders generic email or phone sign-in copy", () => {
    render(<LoginForm />)

    expect(screen.getByText("Enter your email or phone number and password to sign in")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com or phone number")).toBeInTheDocument()
    expect(screen.queryByText(/ethiopian/i)).not.toBeInTheDocument()
  })

  it("clears stale auth errors when the user edits a field", () => {
    authState.error = "Invalid email or password"

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "sam@example.com" } })

    expect(resetAuthErrorMock).toHaveBeenCalledTimes(1)
  })

  it("does not auto-redirect or lock the form based on a client-only session", async () => {
    authState.session = { access_token: "token" }

    render(<LoginForm />)

    expect(screen.getByLabelText("Email or phone number")).not.toBeDisabled()
    expect(screen.getByLabelText("Password")).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: /hide password|show password/i })).not.toBeDisabled()
  })

  it("does not submit again while already loading", () => {
    authState.isLoading = true

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "sam@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.submit(screen.getByRole("button", { name: /signing in/i }).closest("form") as HTMLFormElement)

    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Email or phone number")).toBeDisabled()
    expect(screen.getByLabelText("Password")).toBeDisabled()
  })
})
