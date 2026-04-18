"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import { useSupabaseRbac } from "@/hooks/use-supabase-rbac"
import { useRBAC } from "@/hooks/use-rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { SupabaseNav } from "@/components/supabase-nav"
import { Building2, Shield, Eye, EyeOff, CheckCircle } from "lucide-react"
import {
  validatePassword,
  checkPasswordRequirements,
  changePasswordErrorMessages,
  type ChangePasswordError,
} from "@/lib/auth/password"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isFeatureEnabledClient } from "@/lib/feature-flags/client"
import { getEffectiveDepartmentRole } from "@/lib/server/department-reporting"

export default function ProfilePage() {
  const profileEnabled = isFeatureEnabledClient("PROFILE")

  if (!profileEnabled) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <header className="border-border bg-background shrink-0 border-b">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/logs" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
                <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
                <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <SupabaseNav />
              </div>
            </div>
          </div>
        </header>

        <main className="w-full flex-1">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>This feature is not available yet.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/">Back</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  const { user, profile, updateProfile, isLoading } = useSupabaseAuth()
  const { permissions } = useSupabaseRbac()
  const { canAccessAdmin, hasPermission, hasRole, rbacLoading } = useRBAC()

  const canAccessDepartments =
    hasRole("admin") ||
    hasRole("system-admin") ||
    canAccessAdmin ||
    hasPermission("departments.read") ||
    hasPermission("departments.members.read") ||
    hasPermission("departments.members.manage")

  const [name, setName] = useState(profile?.name || "")
  const [isUpdating, setIsUpdating] = useState(false)
  const [departmentName, setDepartmentName] = useState("")
  const [departmentRoleName, setDepartmentRoleName] = useState("")

  // Password change state
  const { changePassword } = useSupabaseAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [isCooldown, setIsCooldown] = useState(false)

  useEffect(() => {
    const loadDepartment = async () => {
      if (!profile?.department_id) {
        setDepartmentName("No department assigned")
        return
      }

      try {
        const { data, error } = await supabase
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .single()

        if (error) throw error
        setDepartmentName(data?.name || "Unknown department")
      } catch {
        setDepartmentName("Error loading department")
      }
    }

    loadDepartment()
  }, [profile?.department_id])

  useEffect(() => {
    const loadDepartmentRole = async () => {
      if (!user?.id || !profile?.department_id) {
        setDepartmentRoleName("")
        return
      }

      try {
        const role = await getEffectiveDepartmentRole(supabase as any, user.id, profile.department_id)
        setDepartmentRoleName(role.roleName || "")
      } catch {
        setDepartmentRoleName("")
      }
    }

    void loadDepartmentRole()
  }, [profile?.department_id, user?.id])

  // Function to update user profile
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault()

    if (!user) return

    setIsUpdating(true)
    try {
      await updateProfile({
        name,
        // Department ID is not included as it's not updatable from profile
      })
      toast.success("Profile updated successfully")
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsUpdating(false)
    }
  }

  // Password requirements checklist component
  const PasswordRequirements = ({ password }: { password: string }) => {
    const reqs = checkPasswordRequirements(password)
    const items = [
      { label: "At least 8 characters", met: reqs.minLength },
      { label: "One uppercase letter", met: reqs.hasUppercase },
      { label: "One lowercase letter", met: reqs.hasLowercase },
      { label: "One number", met: reqs.hasNumber },
      { label: "One special character", met: reqs.hasSpecial },
    ]

    return (
      <div className="mt-2 space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            {item.met ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-gray-300" />
            )}
            <span className={item.met ? "text-green-600" : "text-muted-foreground"}>{item.label}</span>
          </div>
        ))}
      </div>
    )
  }

  // Handle password change
  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (isCooldown) return

    // Client validation
    if (newPassword !== confirmPassword) {
      setPasswordError(changePasswordErrorMessages.CONFIRM_MISMATCH)
      return
    }

    const validation = validatePassword(newPassword)
    if (!validation.isValid) {
      setPasswordError(validation.errors[0])
      return
    }

    setIsChangingPassword(true)
    try {
      const result = await changePassword(currentPassword, newPassword)

      if (result.success) {
        toast.success("Password changed successfully")
        // Reset form
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setFailedAttempts(0)
      } else {
        const errorKey = result.error || "UNKNOWN_ERROR"
        const hasDetail = typeof result.message === "string" && result.message.trim().length > 0
        const mappedMessage = changePasswordErrorMessages[errorKey as ChangePasswordError]
        const fallbackMessage = hasDetail ? result.message!.trim() : changePasswordErrorMessages.UNKNOWN_ERROR

        setPasswordError(errorKey === "UNKNOWN_ERROR" ? fallbackMessage : mappedMessage ?? fallbackMessage)
        setFailedAttempts((prev) => {
          const newCount = prev + 1
          if (newCount >= 3) {
            setIsCooldown(true)
            setTimeout(() => {
              setIsCooldown(false)
              setFailedAttempts(0)
            }, 5000)
          }
          return newCount
        })
      }
    } catch (error) {
      console.error("Password change error:", error)
      setPasswordError(changePasswordErrorMessages.UNKNOWN_ERROR)
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <header className="border-border bg-background shrink-0 border-b">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/logs" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
                <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
                <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                {user && !rbacLoading && canAccessDepartments ? (
                  <Link href="/departments">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Building2 className="h-4 w-4" />
                      Departments
                    </Button>
                  </Link>
                ) : null}

                {canAccessAdmin ? (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                ) : null}

                <SupabaseNav />
              </div>
            </div>
          </div>
        </header>

        <main className="w-full flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-background shrink-0 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/logs" className="text-left transition-opacity duration-150 ease-in-out hover:opacity-80">
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground mt-1 text-sm">Daily Tracker</p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {user && !rbacLoading && canAccessDepartments ? (
                <Link href="/departments">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Departments
                  </Button>
                </Link>
              ) : null}

              {canAccessAdmin ? (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              ) : null}

              <SupabaseNav />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ""} disabled />
                    <p className="text-muted-foreground text-xs">Your email address cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={departmentName || "Loading..."} disabled className="bg-muted/50" />
                    <p className="text-muted-foreground text-xs">
                      Contact your administrator to change your department
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Department Role</Label>
                    <Input
                      value={departmentRoleName || "No department role assigned"}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>

                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your account details and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Role</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {profile?.role_id === "00000000-0000-0000-0000-000000000001" ? "Admin" : "User"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="mb-2 font-medium">Permissions</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {permissions.length > 0 ? (
                        permissions.map((permission, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {permission.resource}:{permission.action}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No specific permissions assigned</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Card - Password Change */}
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  {isCooldown && (
                    <Alert variant="default" className="border-amber-200 bg-amber-50">
                      <AlertDescription className="text-amber-700">
                        Too many failed attempts. Please wait 5 seconds before trying again.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={isChangingPassword || isCooldown}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-8 w-8 p-0"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={isChangingPassword}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={isChangingPassword || isCooldown}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-8 w-8 p-0"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isChangingPassword}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <PasswordRequirements password={newPassword} />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={isChangingPassword || isCooldown}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-8 w-8 p-0"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isChangingPassword}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isChangingPassword || isCooldown || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
