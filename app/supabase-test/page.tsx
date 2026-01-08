"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { ConnectionStatusProvider, useConnectionStatus } from "@/contexts/connection-status-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

function DetailsView({ details }: { details: Record<string, unknown> }) {
  const entries = useMemo(() => Object.entries(details), [details])

  if (entries.length === 0) return null

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded border p-2 text-xs">
          <div className="text-muted-foreground">{key}</div>
          <div className="font-medium">
            {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : Array.isArray(value)
                ? `Array(${value.length})`
                : value && typeof value === "object"
                  ? "Object"
                  : "—"}
          </div>
        </div>
      ))}
    </div>
  )
}

function SupabaseTestContent() {
  const { results, isRunning, runAllTests, runConnectionTest, reset } = useConnectionStatus()
  const didAutoRun = useRef(false)

  useEffect(() => {
    if (didAutoRun.current) return
    didAutoRun.current = true
    runConnectionTest()
  }, [runConnectionTest])

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
          <CardDescription>Current environment and configuration status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Supabase URL</h3>
                <p className="text-muted-foreground text-sm break-all">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                    process.env.NEXT_PUBLIC_SUPABASE_URL
                  ) : (
                    <Badge variant="destructive">Missing</Badge>
                  )}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Supabase Anon Key</h3>
                <p className="text-muted-foreground text-sm">
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
                    <Badge variant="outline">Configured</Badge>
                  ) : (
                    <Badge variant="destructive">Missing</Badge>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={runAllTests} disabled={isRunning}>
                  {isRunning ? "Running Tests..." : "Run All Tests"}
                </Button>
                <Button variant="outline" onClick={reset} disabled={isRunning}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>Results from connection and functionality tests</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center">No tests have been run yet</div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={`${result.name}-${index}`} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{result.name}</h3>
                      {result.errorCode && (
                        <p className="text-muted-foreground mt-1 text-xs">Error Code: {result.errorCode}</p>
                      )}
                    </div>
                    {result.status === "success" && <Badge variant="success">Success</Badge>}
                    {result.status === "error" && <Badge variant="destructive">Error</Badge>}
                    {result.status === "pending" && <Badge variant="outline">Pending</Badge>}
                  </div>
                  <p className="mt-1 text-sm">{result.message}</p>
                  {result.details && <DetailsView details={result.details} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default function SupabaseTestPage() {
  const { user, profile, isLoading: authLoading } = useSupabaseAuth()
  const router = useRouter()

  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID

  useEffect(() => {
    if (!authLoading && (!user || !isSuperAdmin)) {
      router.push("/admin/settings")
    }
  }, [authLoading, user, isSuperAdmin, router])

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Supabase Integration Test</h1>
            <p className="text-muted-foreground">Verify your Supabase configuration and connection</p>
          </div>
          <div>
            <Button variant="outline" asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>

      {!authLoading && user && isSuperAdmin && (
        <ConnectionStatusProvider>
          <SupabaseTestContent />
        </ConnectionStatusProvider>
      )}
    </div>
  )
}
