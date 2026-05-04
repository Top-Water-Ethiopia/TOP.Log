"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Alert, AlertDescription } from "./ui/alert"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Separator } from "./ui/separator"
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Eye, 
  EyeOff, 
  Lock, 
  Edit,
  Save,
  X,
  CheckCircle
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { validatePassword } from "@/lib/rbac/utils"
import { toast } from "sonner"

export function UserProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, updateProfile, changePassword, isLoading, error, clearError } = useAuth()
  const { userInfo: rbacUser } = useRBAC()
  
  const [activeTab, setActiveTab] = useState("profile")
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  
  // Profile form state
  const [profileName, setProfileName] = useState(user?.name || "")
  const [profileEmail, setProfileEmail] = useState(user?.email || "")
  const [profileDepartment, setProfileDepartment] = useState(user?.department || "")
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Form errors
  const [profileErrors, setProfileErrors] = useState<{
    name?: string
    email?: string
  }>({})
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string
    new?: string
    confirm?: string
  }>({})

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setProfileErrors({})

    // Validate form
    const errors: { name?: string; email?: string } = {}
    
    if (!profileName.trim()) {
      errors.name = "Name is required"
    }
    
    if (!profileEmail.trim()) {
      errors.email = "Email is required"
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors)
      return
    }

    try {
      await updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        department: profileDepartment.trim() || undefined,
      })
      setIsEditingProfile(false)
      toast.success("Profile updated successfully")
    } catch (error) {
      // Error is handled by the auth context
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setPasswordErrors({})

    // Validate form
    const errors: { current?: string; new?: string; confirm?: string } = {}
    
    if (!currentPassword) {
      errors.current = "Current password is required"
    }
    
    if (!newPassword) {
      errors.new = "New password is required"
    } else {
      const passwordValidation = validatePassword(newPassword)
      if (!passwordValidation.isValid) {
        errors.new = passwordValidation.errors[0]
      }
    }
    
    if (!confirmPassword) {
      errors.confirm = "Please confirm your new password"
    } else if (newPassword !== confirmPassword) {
      errors.confirm = "Passwords do not match"
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    try {
      await changePassword(currentPassword, newPassword)
      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password changed successfully")
    } catch (error) {
      // Error is handled by the auth context
    }
  }

  const cancelProfileEdit = () => {
    setProfileName(user?.name || "")
    setProfileEmail(user?.email || "")
    setProfileDepartment(user?.department || "")
    setProfileErrors({})
    setIsEditingProfile(false)
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

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "admin": return "destructive"
      case "manager": return "default"
      case "user": return "secondary"
      case "viewer": return "outline"
      default: return "outline"
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 overflow-auto rounded-lg border bg-background shadow-lg md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="sticky top-0 z-10 border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>
                  {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">User Profile</h2>
                <p className="text-sm text-muted-foreground">Manage your account settings</p>
              </div>
            </div>
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>Update your personal details</CardDescription>
                    </div>
                    {!isEditingProfile ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelProfileEdit}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleProfileUpdate}
                          disabled={isLoading}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      {isEditingProfile ? (
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{user.name}</span>
                        </div>
                      )}
                      {profileErrors.name && (
                        <p className="text-sm text-destructive">{profileErrors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      {isEditingProfile ? (
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{user.email}</span>
                        </div>
                      )}
                      {profileErrors.email && (
                        <p className="text-sm text-destructive">{profileErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Department</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileDepartment}
                          onChange={(e) => setProfileDepartment(e.target.value)}
                          placeholder="Enter your department"
                          disabled={isLoading}
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-2 border rounded-md">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>{user.department || "Not specified"}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Account Status</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        <div className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        <span>{user.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {rbacUser?.role?.displayName || user.role}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Member Since</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {user.lastLogin && (
                    <div className="space-y-2">
                      <Label>Last Login</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(user.lastLogin).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your password to keep your account secure</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {passwordErrors.current && (
                        <p className="text-sm text-destructive">{passwordErrors.current}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {passwordErrors.new && (
                        <p className="text-sm text-destructive">{passwordErrors.new}</p>
                      )}
                      <PasswordRequirements password={newPassword} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
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
                      {passwordErrors.confirm && (
                        <p className="text-sm text-destructive">{passwordErrors.confirm}</p>
                      )}
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Changing password..." : "Change Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Permissions</CardTitle>
                  <CardDescription>View your current role and permissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{rbacUser?.role?.displayName || user.role}</h3>
                      <p className="text-sm text-muted-foreground">
                        {rbacUser?.role?.description || "No description available"}
                      </p>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      Level {rbacUser?.level || 0}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Permission Categories</h4>
                    {rbacUser?.permissionCategories && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-medium text-green-600">Read Permissions</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rbacUser.permissionCategories.read.map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-blue-600">Write Permissions</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rbacUser.permissionCategories.write.map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-red-600">Delete Permissions</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rbacUser.permissionCategories.delete.map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-purple-600">Admin Permissions</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rbacUser.permissionCategories.admin.map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="text-sm text-muted-foreground">
                    <p>Total permissions: {rbacUser?.permissions.length || 0}</p>
                    <p>Role level: {rbacUser?.level || 0} / 4</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
