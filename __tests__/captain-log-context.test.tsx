import React from "react"
import { renderHook, act } from "@testing-library/react"
import { CaptainLogProvider, useCaptainLog } from "@/contexts/captain-log-context"
import { getToday } from "@/lib/date-restrictions"
import * as authContext from "@/contexts/auth-context"
import * as rbacHook from "@/hooks/use-rbac"

jest.mock("@/contexts/auth-context")
jest.mock("@/hooks/use-rbac")

// Mock Supabase-related contexts so tests don't require real Supabase env/config
jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: null,
    isLoading: false,
  }),
  SupabaseAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("@/contexts/supabase-log-context", () => ({
  SupabaseLogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Basic localStorage mock for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <CaptainLogProvider>{children}</CaptainLogProvider>
}

describe("CaptainLogProvider addEntry", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("throws AUTH_ERROR when not authenticated", async () => {
    ;(authContext as any).useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })

    ;(rbacHook as any).useRBAC.mockReturnValue({
      canPerformAction: () => false,
    })

    const { result } = renderHook(() => useCaptainLog(), { wrapper })

    await expect(
      act(async () => {
        await result.current.addEntry({
          date: "2025-01-01",
          objectives: "",
          keyResults: "",
          challenges: "",
          developmentTasks: "",
          featuresCompleted: "",
          challengesAndBlockers: "",
          codeAndPriorities: "",
          systemImprovements: "",
          projectUpdates: "",
          customResponses: [],
        } as any)
      }),
    ).rejects.toMatchObject({ code: "AUTH_ERROR" })
  })

  it("throws PERMISSION_ERROR when user lacks create permission", async () => {
    ;(authContext as any).useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "user-1" },
    })

    ;(rbacHook as any).useRBAC.mockReturnValue({
      canPerformAction: () => false,
    })

    const { result } = renderHook(() => useCaptainLog(), { wrapper })

    await expect(
      act(async () => {
        await result.current.addEntry({
          date: "2025-01-01",
          objectives: "",
          keyResults: "",
          challenges: "",
          developmentTasks: "",
          featuresCompleted: "",
          challengesAndBlockers: "",
          codeAndPriorities: "",
          systemImprovements: "",
          projectUpdates: "",
          customResponses: [],
        } as any)
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_ERROR" })
  })

  it("creates an entry when authenticated and authorized", async () => {
    ;(authContext as any).useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "user-1" },
    })

    ;(rbacHook as any).useRBAC.mockReturnValue({
      canPerformAction: () => true,
    })

    const { result } = renderHook(() => useCaptainLog(), { wrapper })

    const today = getToday()

    await act(async () => {
      await result.current.addEntry({
        date: today,
        objectives: "Ship new feature X",
        keyResults: "Close 5 high-priority tickets",
        challenges: "",
        developmentTasks: "",
        featuresCompleted: "",
        challengesAndBlockers: "",
        codeAndPriorities: "",
        systemImprovements: "",
        projectUpdates: "",
        customResponses: [],
      } as any)
    })

    let entry: any
    await act(async () => {
      entry = result.current.getEntryByDate(today)
    })
    expect(entry).toBeDefined()
    expect(entry?.userId).toBe("user-1")
  })
})
