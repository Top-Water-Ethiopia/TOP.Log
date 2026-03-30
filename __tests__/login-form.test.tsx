import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import LoginForm from "@/components/login-form"

const pushMock = jest.fn()
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
    push: pushMock,
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

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("sam@example.com", "secret123", "/reports")
    })
  })

  it("clears stale auth errors when the user edits a field", () => {
    authState.error = "Invalid email or password"

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } })

    expect(resetAuthErrorMock).toHaveBeenCalledTimes(1)
  })

  it("keeps the form locked while redirecting after login", async () => {
    authState.session = { access_token: "token" }

    render(<LoginForm />)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/reports")
    })

    expect(screen.getByLabelText("Email")).toBeDisabled()
    expect(screen.getByLabelText("Password")).toBeDisabled()
    expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /hide password|show password/i })).toBeDisabled()
  })

  it("does not submit again while already loading", () => {
    authState.isLoading = true

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.submit(screen.getByRole("button", { name: /signing in/i }).closest("form") as HTMLFormElement)

    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Email")).toBeDisabled()
    expect(screen.getByLabelText("Password")).toBeDisabled()
  })
})
