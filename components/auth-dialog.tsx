"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Alert, AlertDescription } from "./ui/alert"
import { Eye, EyeOff, Mail, Lock, User, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { validatePassword, isValidEmail } from "@/lib/rbac/utils"
import { toast } from "sonner"

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const { login, register, isLoading, error, clearError } = useAuth()
  const [activeTab, setActiveTab] = useState("login")
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  
  // Register form state
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Form validation
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})
  const [registerErrors, setRegisterErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLoginErrors({})

    // Validate form
    const errors: { email?: string; password?: string } = {}
    
    if (!loginEmail) {
      errors.email = "Email is required"
    } else if (!isValidEmail(loginEmail)) {
      errors.email = "Invalid email format"
    }
    
    if (!loginPassword) {
      errors.password = "Password is required"
    }

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors)
      return
    }

    try {
      await login(loginEmail, loginPassword)
      onClose()
    } catch {
      // Error is handled by the auth context
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setRegisterErrors({})

    // Validate form
    const errors: {
      name?: string
      email?: string
      password?: string
      confirmPassword?: string
    } = {}
    
    if (!registerName.trim()) {
      errors.name = "Name is required"
    }
    
    if (!registerEmail) {
      errors.email = "Email is required"
    } else if (!isValidEmail(registerEmail)) {
      errors.email = "Invalid email format"
    }
    
    if (!registerPassword) {
      errors.password = "Password is required"
    } else {
      const passwordValidation = validatePassword(registerPassword)
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors[0]
      }
    }
    
    if (!registerConfirmPassword) {
      errors.confirmPassword = "Please confirm your password"
    } else if (registerPassword !== registerConfirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors)
      return
    }

    try {
      await register({
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
        role: "viewer",
        isActive: true,
      })
      setActiveTab("login")
      toast.success("Account created! Please log in.")
    } catch {
      // Error is handled by the auth context
    }
  }

  const PasswordRequirements = ({ password }: { password: string }) => {
    const requirements = [
      { label: "At least 8 characters", test: password.length >= 8 },
      { label: "One uppercase letter", test: /[A-Z]/.test(password) },
      { label: "One lowercase letter", test: /[a-z]/.test(password) },
      { label: "One number", test: /\d/.test(password) },
      { label: "One special character", test: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ]

    return (
      <div className="space-y-1 mt-2">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            {req.test ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-gray-300" />
            )}
            <span className={req.test ? "text-green-600" : "text-muted-foreground"}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 overflow-auto rounded-lg border bg-background shadow-lg md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="sticky top-0 z-10 border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Authentication</h2>
              <p className="text-sm text-muted-foreground">Sign in to your account</p>
            </div>
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {loginErrors.email && (
                    <p className="text-sm text-destructive">{loginErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {loginErrors.password && (
                    <p className="text-sm text-destructive">{loginErrors.password}</p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Demo admin: admin@captains-log.local / admin123
                </p>
              </div>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {registerErrors.name && (
                    <p className="text-sm text-destructive">{registerErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {registerErrors.email && (
                    <p className="text-sm text-destructive">{registerErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {registerErrors.password && (
                    <p className="text-sm text-destructive">{registerErrors.password}</p>
                  )}
                  <PasswordRequirements password={registerPassword} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {registerErrors.confirmPassword && (
                    <p className="text-sm text-destructive">{registerErrors.confirmPassword}</p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  New accounts will be created with "User" role by default.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
