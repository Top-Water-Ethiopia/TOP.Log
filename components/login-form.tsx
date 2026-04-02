"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isLoading, error, session, resetAuthError } = useSupabaseAuth()
  const { theme, setTheme } = useTheme()
  const darkModeEnabled = isFeatureEnabledClient("DARK_MODE")
  const selfServiceAuthEnabled = isFeatureEnabledClient("SELF_SERVICE_AUTH")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const redirectTo = searchParams?.get("redirect") || "/"
  const isBusy = isLoading || isRedirecting || !!session

  // Set mounted for theme toggle
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      setIsRedirecting(true)
      router.push(redirectTo)
    }
  }, [session, router, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBusy) return

    try {
      await login(identifier, password, redirectTo)
      // Redirect happens in the auth context after successful login
    } catch {
      // Error handling is done in the auth context via the error state
      // No need to log here as it's already displayed in the UI
    }
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center p-4">
      {/* Theme Toggle */}
      {darkModeEnabled ? (
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newTheme = theme === "dark" ? "light" : "dark"
              setTheme(newTheme)
            }}
            className="h-9 w-9"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      ) : null}

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>Enter your email or phone number and password to sign in</CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin} aria-busy={isBusy}>
          <CardContent className="space-y-6">
            {error ? (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="identifier">Email or phone number</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="name@example.com or phone number"
                value={identifier}
                onChange={(e) => {
                  if (error) resetAuthError()
                  setIdentifier(e.target.value)
                }}
                required
                autoComplete="username"
                disabled={isBusy}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    if (error) resetAuthError()
                    setPassword(e.target.value)
                  }}
                  required
                  className="pr-10"
                  autoComplete="current-password"
                  disabled={isBusy}
                  aria-describedby={error ? "login-error" : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isBusy}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="h-12 w-full text-base font-medium" disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isRedirecting || session ? "Redirecting..." : "Signing in..."}
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            {selfServiceAuthEnabled ? (
              <div className="text-center text-sm">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </div>
            ) : null}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
