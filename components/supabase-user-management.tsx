"use client";

import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Calendar,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  UserX,
  UserCheck,
  Loader2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { toast } from "sonner";

// Role IDs from schema
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const USER_ROLE_ID = '00000000-0000-0000-0000-000000000002';

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  profile: {
    id: string;
    name: string;
    department: string | null;
    role_id: string;
    role_name: string;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
  } | null;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export function SupabaseUserManagement() {
  const { user: currentUser, profile: currentProfile } = useSupabaseAuth();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithProfile | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<UserWithProfile | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState<"email" | "direct">("email");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  
  // Check if current user is super admin or admin
  const isSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID;
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || isSuperAdmin;

  // Create user form state
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role_id: USER_ROLE_ID,
    department: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit user form state
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    department: "",
    role_id: USER_ROLE_ID,
    is_active: true,
  });

  // Load departments
  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setDepartments(result.data.filter((d: Department) => d.is_active));
      }
    } catch (error) {
      console.error("Failed to load departments:", error);
    }
  };

  // Load all roles
  const loadRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setRoles(result.data || []);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  // Load all users
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Use the API route which fetches users with emails from auth.users using admin client
      // This ensures every user has an email from auth.users
      const response = await fetch('/api/admin/users?per_page=1000');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const result = await response.json();
      
      if (result.data && Array.isArray(result.data)) {
        // Map the API response to UserWithProfile format
        const usersWithProfiles: UserWithProfile[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email || 'N/A', // Should always have email from auth.users
          created_at: user.created_at,
          profile: {
            id: user.profile.id,
            name: user.profile.name,
            department: user.profile.department,
            role_id: user.profile.role_id,
            role_name: user.profile.role_name || 'user',
            is_active: user.profile.is_active,
            created_at: user.profile.created_at,
            last_login: user.profile.last_login,
          },
        }));
        setUsers(usersWithProfiles);
      } else {
        setUsers([]);
      }
    } catch (error: any) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users: " + (error.message || "Unknown error"));
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadDepartments();
      loadRoles();
      loadUsers();
    }
  }, [isAdmin]);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.profile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.profile?.department?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesRole = roleFilter === "all" || user.profile?.role_id === roleFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && user.profile?.is_active) ||
      (statusFilter === "inactive" && !user.profile?.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const validateCreateUserForm = () => {
    const errors: Record<string, string> = {};

    if (!createUserForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!createUserForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserForm.email)) {
      errors.email = "Invalid email format";
    } else if (users.some(u => u.email.toLowerCase() === createUserForm.email.toLowerCase())) {
      errors.email = "User with this email already exists";
    }

    if (!createUserForm.password) {
      errors.password = "Password is required";
    } else if (createUserForm.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!createUserForm.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (createUserForm.password !== createUserForm.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateCreateUserForm()) return;

    try {
      // Create user via API endpoint (uses admin client server-side)
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createUserForm.email,
          password: createUserForm.password,
          name: createUserForm.name.trim(),
          role_id: createUserForm.role_id,
          department: createUserForm.department.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create user");
      }

      // Reset form
      setCreateUserForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role_id: USER_ROLE_ID,
        department: "",
      });
      setFormErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowCreateUser(false);

      toast.success("User created successfully");
      await loadUsers();
    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast.error("Failed to create user: " + (error.message || "Unknown error"));
    }
  };

  const handleUpdateUserRole = async (user: UserWithProfile, newRoleId: string) => {
    if (!user.profile) return;

    // Prevent admins (non-super admins) from assigning super admin role
    if (newRoleId === SUPER_ADMIN_ROLE_ID && !isSuperAdmin) {
      toast.error("Only super admins can assign super admin role");
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          role_id: newRoleId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update user role");
      }

      toast.success("User role updated successfully");
      await loadUsers();
    } catch (error: any) {
      console.error("Failed to update user role:", error);
      toast.error("Failed to update user role: " + (error.message || "Unknown error"));
    }
  };

  const validateEditUserForm = () => {
    const errors: Record<string, string> = {};

    if (!editUserForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!editUserForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUserForm.email)) {
      errors.email = "Invalid email format";
    } else if (users.some(u => u.id !== editingUser?.id && u.email.toLowerCase() === editUserForm.email.toLowerCase())) {
      errors.email = "Email is already in use by another user";
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateUser = async () => {
    if (!validateEditUserForm() || !editingUser || isUpdatingUser) return;

    setIsUpdatingUser(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: editingUser.id,
          name: editUserForm.name.trim(),
          email: editUserForm.email.trim().toLowerCase(),
          department: editUserForm.department.trim() || null,
          role_id: editUserForm.role_id,
          is_active: editUserForm.is_active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      setShowEditUser(false);
      setEditingUser(null);
      setEditFormErrors({});
      await loadUsers();
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast.error("Failed to update user: " + (error.message || "Unknown error"));
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user: UserWithProfile) => {
    if (!user.profile) return;

    if (user.id === currentUser?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    // Set loading state
    setTogglingUserId(user.id);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          is_active: !user.profile.is_active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update user status");
      }

      toast.success(`User ${user.profile.is_active ? "deactivated" : "activated"} successfully`);
      await loadUsers();
    } catch (error: any) {
      console.error("Failed to update user status:", error);
      toast.error("Failed to update user status: " + (error.message || "Unknown error"));
    } finally {
      // Clear loading state
      setTogglingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.id === currentUser?.id) {
      toast.error("You cannot delete your own account");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      return;
    }

    try {
      // Delete user profile (this will cascade delete related data)
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userToDelete.id);

      if (error) throw error;

      // Note: To delete the auth user, you need admin API access
      // For now, we'll just delete the profile
      toast.success("User profile deleted successfully");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user: " + (error.message || "Unknown error"));
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;

    setResettingPassword(true);

    try {
      if (resetPasswordMode === "email") {
        // Send password reset email
        const response = await fetch('/api/admin/users/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userToResetPassword.id,
            email: userToResetPassword.email,
            mode: 'email',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || "Failed to send password reset email");
        }

        toast.success(`Password reset email sent to ${userToResetPassword.email}`);
      } else {
        // Set new password directly
        if (!newPassword) {
          toast.error("Password is required");
          setResettingPassword(false);
          return;
        }

        if (newPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          setResettingPassword(false);
          return;
        }

        if (newPassword !== confirmNewPassword) {
          toast.error("Passwords do not match");
          setResettingPassword(false);
          return;
        }

        const response = await fetch('/api/admin/users/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userToResetPassword.id,
            email: userToResetPassword.email,
            mode: 'direct',
            password: newPassword,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || "Failed to reset password");
        }

        toast.success("Password reset successfully");
        setNewPassword("");
        setConfirmNewPassword("");
      }

      setShowResetPasswordDialog(false);
      setUserToResetPassword(null);
      setResetPasswordMode("email");
    } catch (error: any) {
      console.error("Failed to reset password:", error);
      toast.error("Failed to reset password: " + (error.message || "Unknown error"));
    } finally {
      setResettingPassword(false);
    }
  };

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "admin": return "destructive";
      case "user": return "secondary";
      default: return "outline";
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You need admin privileges to access user management.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Button onClick={loadUsers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateUser(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.length > 0 ? (
              roles
                .filter(role => isSuperAdmin || role.id !== SUPER_ADMIN_ROLE_ID)
                .map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))
            ) : (
              <>
                {isSuperAdmin && (
                  <SelectItem value={SUPER_ADMIN_ROLE_ID}>Super Admin</SelectItem>
                )}
                <SelectItem value={ADMIN_ROLE_ID}>Admin</SelectItem>
                <SelectItem value={USER_ROLE_ID}>User</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full inline-block align-middle">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
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
                            <AvatarFallback>
                              {user.profile?.name.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.profile?.name || "N/A"}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.profile?.role_id || ""}
                          onValueChange={(newRoleId) => handleUpdateUserRole(user, newRoleId)}
                          disabled={user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-[150px]">
                            <Badge variant={getRoleBadgeVariant(user.profile?.role_name || "user")}>
                              {user.profile?.role_name || "user"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {roles.length > 0 ? (
                              roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={
                                        role.id === ADMIN_ROLE_ID ? "destructive" :
                                        role.id === USER_ROLE_ID ? "secondary" : 
                                        "outline"
                                      }
                                    >
                                      {role.name}
                                    </Badge>
                                    {role.description && (
                                      <span className="text-xs text-muted-foreground">
                                        {role.description}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value={ADMIN_ROLE_ID}>
                                  <Badge variant="destructive">Admin</Badge>
                                </SelectItem>
                                <SelectItem value={USER_ROLE_ID}>
                                  <Badge variant="secondary">User</Badge>
                                </SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{user.profile?.department || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.profile?.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {user.profile?.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.profile?.last_login
                            ? new Date(user.profile.last_login).toLocaleDateString()
                            : "Never"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              setEditUserForm({
                                name: user.profile?.name || "",
                                email: user.email,
                                department: user.profile?.department || "",
                                role_id: user.profile?.role_id || USER_ROLE_ID,
                                is_active: user.profile?.is_active ?? true,
                              });
                              setShowEditUser(true);
                            }}
                            title="Edit user"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={user.id === currentUser?.id || togglingUserId === user.id}
                            title={user.profile?.is_active ? "Lock/Deactivate user" : "Unlock/Activate user"}
                          >
                            {togglingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.profile?.is_active ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUserToResetPassword(user);
                              setResetPasswordMode("email");
                              setNewPassword("");
                              setConfirmNewPassword("");
                              setShowResetPasswordDialog(true);
                            }}
                            title="Reset password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setUserToDelete(user);
                              setShowDeleteDialog(true);
                            }}
                            disabled={user.id === currentUser?.id}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive an email to confirm their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password (min 8 characters)"
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={createUserForm.confirmPassword}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
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
              {formErrors.confirmPassword && (
                <p className="text-sm text-destructive">{formErrors.confirmPassword}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={createUserForm.role_id}
                  onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length > 0 ? (
                      roles
                        .filter(role => isSuperAdmin || role.id !== SUPER_ADMIN_ROLE_ID)
                        .map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{role.name}</span>
                            {role.description && (
                              <span className="text-xs text-muted-foreground">
                                {role.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        {isSuperAdmin && (
                          <SelectItem value={SUPER_ADMIN_ROLE_ID}>Super Admin</SelectItem>
                        )}
                        <SelectItem value={USER_ROLE_ID}>User</SelectItem>
                        <SelectItem value={ADMIN_ROLE_ID}>Admin</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department (Optional)</Label>
                <Select
                  value={createUserForm.department || "__none__"}
                  onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, department: value === "__none__" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name} {dept.code && `(${dept.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Edit User Dialog */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editUserForm.name}
                onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
              />
              {editFormErrors.name && (
                <p className="text-sm text-destructive">{editFormErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email address"
              />
              {editFormErrors.email && (
                <p className="text-sm text-destructive">{editFormErrors.email}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUserForm.role_id}
                  onValueChange={(value) => setEditUserForm(prev => ({ ...prev, role_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length > 0 ? (
                      roles
                        .filter(role => isSuperAdmin || role.id !== SUPER_ADMIN_ROLE_ID)
                        .map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{role.name}</span>
                            {role.description && (
                              <span className="text-xs text-muted-foreground">
                                {role.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        {isSuperAdmin && (
                          <SelectItem value={SUPER_ADMIN_ROLE_ID}>Super Admin</SelectItem>
                        )}
                        <SelectItem value={USER_ROLE_ID}>User</SelectItem>
                        <SelectItem value={ADMIN_ROLE_ID}>Admin</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department (Optional)</Label>
                <Select
                  value={editUserForm.department || "__none__"}
                  onValueChange={(value) => setEditUserForm(prev => ({ ...prev, department: value === "__none__" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name} {dept.code && `(${dept.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-active"
                checked={editUserForm.is_active}
                onChange={(e) => setEditUserForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditUser(false);
                setEditingUser(null);
                setEditFormErrors({});
              }}
              disabled={isUpdatingUser}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdatingUser}>
              {isUpdatingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {userToResetPassword?.profile?.name || userToResetPassword?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={resetPasswordMode === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setResetPasswordMode("email")}
                className="flex-1"
              >
                Send Reset Email
              </Button>
              <Button
                variant={resetPasswordMode === "direct" ? "default" : "outline"}
                size="sm"
                onClick={() => setResetPasswordMode("direct")}
                className="flex-1"
              >
                Set New Password
              </Button>
            </div>

            {resetPasswordMode === "email" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  A password reset email will be sent to <strong>{userToResetPassword?.email}</strong>. 
                  The user will receive a link to reset their password.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 8 characters)"
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmNewPassword"
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowResetPasswordDialog(false);
                setUserToResetPassword(null);
                setResetPasswordMode("email");
                setNewPassword("");
                setConfirmNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={resettingPassword || (resetPasswordMode === "direct" && (!newPassword || newPassword !== confirmNewPassword))}
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {resetPasswordMode === "email" ? "Sending..." : "Resetting..."}
                </>
              ) : (
                resetPasswordMode === "email" ? "Send Reset Email" : "Reset Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the user profile for {userToDelete?.profile?.name || userToDelete?.email}.
              This action cannot be undone. The user will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

