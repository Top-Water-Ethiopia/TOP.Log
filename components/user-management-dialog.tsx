"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  Mail,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import type { User, Role } from "@/lib/rbac/types"
import { loadFromStorage, saveToStorage, generateId, isValidEmail, validatePassword, hashPassword } from "@/lib/rbac/utils"

export function UserManagementDialog({ onClose }: { onClose: () => void }) {
  const { user: currentUser } = useAuth()
  const { getAssignableRoles, canManageUser } = useRBAC()
  
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // Create user form state
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as const,
    department: "",
    isActive: true,
  })
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Load data
  useEffect(() => {
    const loadData = () => {
      try {
        const loadedUsers = loadFromStorage("USERS", [] as User[])
        const loadedRoles = loadFromStorage("ROLES", [])
        setUsers(loadedUsers)
        setRoles(loadedRoles)
      } catch (error) {
        console.error("Failed to load user data:", error)
        toast.error("Failed to load user data")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.department?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const validateCreateUserForm = () => {
    const errors: Record<string, string> = {}

    if (!createUserForm.name.trim()) {
      errors.name = "Name is required"
    }

    if (!createUserForm.email.trim()) {
      errors.email = "Email is required"
    } else if (!isValidEmail(createUserForm.email)) {
      errors.email = "Invalid email format"
    } else if (users.some(u => u.email.toLowerCase() === createUserForm.email.toLowerCase())) {
      errors.email = "Email already exists"
    }

    if (!createUserForm.password) {
      errors.password = "Password is required"
    } else {
      const passwordValidation = validatePassword(createUserForm.password)
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors[0]
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async () => {
    if (!validateCreateUserForm()) return

    try {
      const hashedPassword = await hashPassword(createUserForm.password)
      
      const newUser: User & { password: string } = {
        id: generateId(),
        name: createUserForm.name.trim(),
        email: createUserForm.email.trim().toLowerCase(),
        role: createUserForm.role,
        department: createUserForm.department.trim() || undefined,
        isActive: createUserForm.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        password: hashedPassword,
        metadata: {
          createdBy: currentUser?.id,
        },
      }

      const updatedUsers = [...users, newUser]
      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)

      // Reset form
      setCreateUserForm({
        name: "",
        email: "",
        password: "",
        role: "user",
        department: "",
        isActive: true,
      })
      setFormErrors({})
      setShowCreateUser(false)

      toast.success("User created successfully")
    } catch (error) {
      console.error("Failed to create user:", error)
      toast.error("Failed to create user")
    }
  }

  const handleUpdateUserRole = async (user: User, newRole: string) => {
    if (!currentUser || !canManageUser(user)) {
      toast.error("Insufficient permissions to manage this user")
      return
    }

    try {
      const updatedUsers = users.map(u => 
        u.id === user.id 
          ? { 
              ...u, 
              role: newRole as any, 
              updatedAt: new Date().toISOString(),
              metadata: {
                ...u.metadata,
                updatedBy: currentUser.id,
                roleChangedAt: new Date().toISOString(),
                previousRole: u.role,
              }
            }
          : u
      )

      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)
      toast.success(`User role updated to ${newRole}`)
    } catch (error) {
      console.error("Failed to update user role:", error)
      toast.error("Failed to update user role")
    }
  }

  const handleToggleUserStatus = async (user: User) => {
    if (!currentUser || !canManageUser(user)) {
      toast.error("Insufficient permissions to manage this user")
      return
    }

    if (user.id === currentUser.id) {
      toast.error("You cannot deactivate your own account")
      return
    }

    try {
      const updatedUsers = users.map(u => 
        u.id === user.id 
          ? { 
              ...u, 
              isActive: !u.isActive, 
              updatedAt: new Date().toISOString(),
              metadata: {
                ...u.metadata,
                updatedBy: currentUser.id,
                statusChangedAt: new Date().toISOString(),
              }
            }
          : u
      )

      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)
      toast.success(`User ${user.isActive ? "deactivated" : "activated"} successfully`)
    } catch (error) {
      console.error("Failed to update user status:", error)
      toast.error("Failed to update user status")
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!currentUser || !canManageUser(user)) {
      toast.error("Insufficient permissions to delete this user")
      return
    }

    if (user.id === currentUser.id) {
      toast.error("You cannot delete your own account")
      return
    }

    if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      return
    }

    try {
      const updatedUsers = users.filter(u => u.id !== user.id)
      setUsers(updatedUsers)
      saveToStorage("USERS", updatedUsers)
      toast.success("User deleted successfully")
    } catch (error) {
      console.error("Failed to delete user:", error)
      toast.error("Failed to delete user")
    }
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

  const assignableRoles = getAssignableRoles()

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 overflow-auto rounded-lg border bg-background shadow-lg md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-6xl md:-translate-x-1/2 md:-translate-y-1/2 md:h-[80vh]">
        <div className="sticky top-0 z-10 border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">User Management</h2>
              <p className="text-sm text-muted-foreground">Manage users, roles, and permissions</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCreateUser(true)}
                disabled={!assignableRoles.length}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users ({filteredUsers.length})
              </CardTitle>
              <CardDescription>
                Manage user accounts and assign roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>
                                {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManageUser(user) && assignableRoles.length > 0 ? (
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => handleUpdateUserRole(user, newRole)}
                              disabled={user.id === currentUser?.id}
                            >
                              <SelectTrigger className="w-[120px]">
                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                  {user.role}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.name}>
                                    <Badge variant={getRoleBadgeVariant(role.name)}>
                                      {role.name}
                                    </Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.department || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                            <span className="text-sm">{user.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canManageUser(user) && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleUserStatus(user)}
                                  disabled={user.id === currentUser?.id}
                                >
                                  {user.isActive ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={user.id === currentUser?.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Create User Dialog */}
        <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. They will be created with the selected role.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={createUserForm.name}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                  {formErrors.name && (
                    <p className="text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email"
                  />
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={createUserForm.role}
                    onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.displayName} ({role.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input
                    id="department"
                    value={createUserForm.department}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Enter department"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {formErrors.password && (
                  <p className="text-sm text-destructive">{formErrors.password}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
