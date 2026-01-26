"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { ArrowLeft, Home, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminNotFound() {
  const router = useRouter()
  const pathname = usePathname()

  const requestedPath = useMemo(() => {
    if (!pathname) return null
    return pathname
  }, [pathname])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "404 — Admin"
    }
  }, [])

  return (
    <main className="flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-xl">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-start gap-4">
              <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-lg border">
                <SearchX className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wide">404</div>
                <CardTitle className="mt-1 text-xl">Resource not found</CardTitle>
                <CardDescription className="mt-2">
                  The admin page you requested doesn’t exist, was moved, or the URL is incorrect.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {requestedPath ? (
              <div className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2">
                <div className="text-xs font-medium">Requested path</div>
                <div className="mt-1 font-mono text-xs break-all">{requestedPath}</div>
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="justify-between gap-3 border-t">
            <Button asChild variant="default">
              <Link href="/admin">
                <Home />
                Go to Admin Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft />
              Go Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
