"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { z } from "zod"
import { logger } from "../lib/observability/logger"
import { createSampleData, testSupabaseConnection } from "../lib/test-supabase"
import { useSupabaseAuth } from "./supabase-auth-context"

export type ConnectionTestStatus = "success" | "error" | "pending"

export type ConnectionTestName = "Connection Test" | "Sample Data Test"

export interface ConnectionTestResult {
  name: ConnectionTestName
  status: ConnectionTestStatus
  message: string
  errorCode?: string
  details?: Record<string, unknown>
}

export interface ConnectionStatusState {
  isRunning: boolean
  results: ConnectionTestResult[]
}

interface ConnectionStatusContextType extends ConnectionStatusState {
  runConnectionTest: () => Promise<void>
  runAllTests: () => Promise<void>
  reset: () => void
}

const ConnectionStatusContext = createContext<ConnectionStatusContextType | undefined>(undefined)

const SupabaseAuthUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email().optional().nullable(),
  })
  .passthrough()

type SupabaseAuthUser = z.infer<typeof SupabaseAuthUserSchema>

export function ConnectionStatusProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth()

  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<ConnectionTestResult[]>([])

  const reset = useCallback(() => {
    setResults([])
    setIsRunning(false)
  }, [])

  const getValidatedUser = useCallback((): SupabaseAuthUser => {
    const parsed = SupabaseAuthUserSchema.safeParse(user)

    if (!parsed.success) {
      logger.error("Invalid auth user object for connection tests", parsed.error, {
        code: "CONNECTION_USER_INVALID",
      })
      throw new Error("Invalid authenticated user")
    }

    return parsed.data
  }, [user])

  const runConnectionTest = useCallback(async () => {
    setIsRunning(true)

    try {
      const validatedUser = getValidatedUser()
      const connectionResult = await testSupabaseConnection()

      if (!connectionResult.success) {
        logger.error("Supabase connection test failed", connectionResult.error, {
          code: "SUPABASE_CONNECTION_TEST_FAILED",
          userId: validatedUser.id,
          email: validatedUser.email ?? undefined,
          hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        })

        setResults([
          {
            name: "Connection Test",
            status: "error",
            message: connectionResult.message,
            errorCode: "SUPABASE_CONNECTION_TEST_FAILED",
          },
        ])
        return
      }

      setResults([
        {
          name: "Connection Test",
          status: "success",
          message: connectionResult.message,
          details: {
            table: "roles",
            rowCount: Array.isArray(connectionResult.data) ? connectionResult.data.length : undefined,
            hasData: Boolean(connectionResult.data),
          },
        },
      ])
    } catch (error: unknown) {
      logger.error("Unexpected error during connection test", error, {
        code: "SUPABASE_CONNECTION_TEST_EXCEPTION",
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      })

      setResults([
        {
          name: "Connection Test",
          status: "error",
          message: error instanceof Error ? error.message : "Unexpected error",
          errorCode: "SUPABASE_CONNECTION_TEST_EXCEPTION",
        },
      ])
    } finally {
      setIsRunning(false)
    }
  }, [getValidatedUser])

  const runAllTests = useCallback(async () => {
    setIsRunning(true)

    try {
      const validatedUser = getValidatedUser()

      const connectionResult = await testSupabaseConnection()
      const connectionTest: ConnectionTestResult = {
        name: "Connection Test",
        status: connectionResult.success ? "success" : "error",
        message: connectionResult.message,
        errorCode: connectionResult.success ? undefined : "SUPABASE_CONNECTION_TEST_FAILED",
        details: connectionResult.success
          ? {
              table: "roles",
              rowCount: Array.isArray(connectionResult.data) ? connectionResult.data.length : undefined,
              hasData: Boolean(connectionResult.data),
            }
          : undefined,
      }

      setResults([connectionTest])

      if (!connectionResult.success) {
        logger.error("Supabase connection test failed", connectionResult.error, {
          code: "SUPABASE_CONNECTION_TEST_FAILED",
          userId: validatedUser.id,
          email: validatedUser.email ?? undefined,
          hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        })
        return
      }

      setResults((prev) => [
        ...prev,
        {
          name: "Sample Data Test",
          status: "pending",
          message: "Creating sample data...",
        },
      ])

      const sampleDataResult = await createSampleData(validatedUser.id)

      if (!sampleDataResult.success) {
        logger.error("Supabase sample data test failed", sampleDataResult.error, {
          code: "SUPABASE_SAMPLE_DATA_TEST_FAILED",
          userId: validatedUser.id,
          email: validatedUser.email ?? undefined,
        })
      }

      setResults((prev) =>
        prev.map((r) =>
          r.name === "Sample Data Test"
            ? {
                name: "Sample Data Test",
                status: sampleDataResult.success ? "success" : "error",
                message: sampleDataResult.message,
                errorCode: sampleDataResult.success ? undefined : "SUPABASE_SAMPLE_DATA_TEST_FAILED",
                details: sampleDataResult.success
                  ? {
                      createdEntries: sampleDataResult.entries?.length ?? 0,
                    }
                  : undefined,
              }
            : r
        )
      )
    } catch (error: unknown) {
      logger.error("Unexpected error during runAllTests", error, {
        code: "SUPABASE_TESTS_EXCEPTION",
      })

      setResults((prev) => [
        ...prev,
        {
          name: "Connection Test",
          status: "error",
          message: error instanceof Error ? error.message : "Unexpected error",
          errorCode: "SUPABASE_TESTS_EXCEPTION",
        },
      ])
    } finally {
      setIsRunning(false)
    }
  }, [getValidatedUser])

  const value = useMemo<ConnectionStatusContextType>(
    () => ({
      isRunning,
      results,
      runConnectionTest,
      runAllTests,
      reset,
    }),
    [isRunning, results, runConnectionTest, runAllTests, reset]
  )

  return <ConnectionStatusContext.Provider value={value}>{children}</ConnectionStatusContext.Provider>
}

export function useConnectionStatus() {
  const context = useContext(ConnectionStatusContext)

  if (!context) {
    throw new Error("useConnectionStatus must be used within a ConnectionStatusProvider")
  }

  return context
}
