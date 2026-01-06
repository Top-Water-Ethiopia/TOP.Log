"use client";

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionMenu } from "@/components/ui/action-menu";
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
  MailCheck,
  FilePlus,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { UsersTableSkeleton } from "@/components/skeletons/users-table-skeleton"
import { apiFetch, getErrorMessage } from "@/lib/api-client";
import { RightSidePanel } from "@/components/ui/right-side-panel";
import useSWR from "swr";
import { DataTable } from "@/components/ui/data-table";

// Role IDs from schema
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000010';
const USER_ROLE_ID = '00000000-0000-0000-0000-000000000002';
const SYSTEM_ADMIN_ROLE_NAME = "system-admin";

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at?: string | null;
  profile: {
    id: string;
    name: string;
    department_id: string | null;
    role_id: string;
    role_name: string;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
  } | null;
}

type AdminUsersApiUser = {
  id: string
  email: string
  email_confirmed_at: string | null
  created_at: string
  profile: NonNullable<UserWithProfile["profile"]>
}

type AdminUsersResponse = {
  data: AdminUsersApiUser[]
  pagination?: {
    page: number
    perPage: number
    totalCount: number
    totalPages: number
  }
}

type AdminCreateUserResponse = {
  user: {
    id: string
    email: string | null
    created_at: string | null
  }
  profile: {
    id: string
    user_id: string
    name: string
    department_id: string | null
    role_id: string
    is_active: boolean
    created_at: string
    updated_at?: string
    last_login?: string | null
  }
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
  const [userDepartmentsByUserId, setUserDepartmentsByUserId] = useState<Record<string, string[]>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
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
  const isAdmin = currentProfile?.role_id === ADMIN_ROLE_ID || currentProfile?.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin;

  // Create user form state
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role_id: USER_ROLE_ID,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit user form state
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role_id: USER_ROLE_ID,
    is_active: true,
    email_verified: false,
  });

  const lastUsersErrorRef = useRef<string | null>(null)
  const lastRolesErrorRef = useRef<string | null>(null)
  const lastDepartmentsErrorRef = useRef<string | null>(null)
  const lastMembershipsErrorRef = useRef<string | null>(null)

  const usersKey = isAdmin ? "/api/admin/users?per_page=1000" : null
  const rolesKey = isAdmin ? "/api/admin/roles" : null
  const departmentsKey = isAdmin ? "/api/admin/departments" : null
  const membershipsKey = isAdmin ? "/api/admin/users/memberships" : null

  const {
    data: usersResponse,
    error: usersError,
    isLoading: isUsersLoading,
    isValidating: isUsersValidating,
    mutate: mutateUsers,
  } = useSWR<AdminUsersResponse>(usersKey)

  const {
    data: rolesResponse,
    error: rolesError,
    isLoading: isRolesLoading,
    mutate: mutateRoles,
  } = useSWR<{ data: Role[] }>(rolesKey)

  const {
    data: departmentsResponse,
    error: departmentsError,
    isLoading: isDepartmentsLoading,
    mutate: mutateDepartments,
  } = useSWR<{ data: Department[] }>(departmentsKey)

  const {
    data: membershipsResponse,
    error: membershipsError,
    isLoading: isMembershipsLoading,
    mutate: mutateMemberships,
  } = useSWR<{ data: Record<string, string[]> }>(membershipsKey)

  const isLoading = isUsersLoading || isRolesLoading || isDepartmentsLoading || isMembershipsLoading

  useEffect(() => {
    if (!usersError) {
      lastUsersErrorRef.current = null
      return
    }
    const message = getErrorMessage(usersError, "Failed to load users")
    if (lastUsersErrorRef.current !== message) {
      toast.error(message)
      lastUsersErrorRef.current = message
    }
  }, [usersError])

  useEffect(() => {
    if (!rolesError) {
      lastRolesErrorRef.current = null
      return
    }
    const message = getErrorMessage(rolesError, "Failed to load roles")
    if (lastRolesErrorRef.current !== message) {
      toast.error(message)
      lastRolesErrorRef.current = message
    }
  }, [rolesError])

  useEffect(() => {
    if (!departmentsError) {
      lastDepartmentsErrorRef.current = null
      return
    }
    const message = getErrorMessage(departmentsError, "Failed to load departments")
    if (lastDepartmentsErrorRef.current !== message) {
      toast.error(message)
      lastDepartmentsErrorRef.current = message
    }
  }, [departmentsError])

  useEffect(() => {
    if (!membershipsError) {
      lastMembershipsErrorRef.current = null
      return
    }
    const message = getErrorMessage(membershipsError, "Failed to load user department memberships")
    if (lastMembershipsErrorRef.current !== message) {
      toast.error(message)
      lastMembershipsErrorRef.current = message
    }
  }, [membershipsError])

  const mappedUsers = useMemo<UserWithProfile[]>(() => {
    const rows = Array.isArray(usersResponse?.data) ? usersResponse!.data : []
    return rows.map((user) => ({
      id: user.id,
      email: user.email || "N/A",
      email_confirmed_at: user.email_confirmed_at || null,
      created_at: user.created_at,
      profile: {
        id: user.profile.id,
        name: user.profile.name,
        department_id: user.profile.department_id,
        role_id: user.profile.role_id,
        role_name: user.profile.role_name || "user",
        is_active: user.profile.is_active,
        created_at: user.profile.created_at,
        last_login: user.profile.last_login,
      },
    }))
  }, [usersResponse])

  const activeDepartments = useMemo(() => {
    const list = departmentsResponse?.data || []
    return list.filter((d) => d.is_active)
  }, [departmentsResponse])

  const membershipsByUserId = useMemo(() => {
    return (membershipsResponse?.data || {}) as Record<string, string[]>
  }, [membershipsResponse])

  useEffect(() => {
    setUsers(mappedUsers)
  }, [mappedUsers])

  useEffect(() => {
    setDepartments(activeDepartments)
  }, [activeDepartments])

  useEffect(() => {
    setRoles(rolesResponse?.data || [])
  }, [rolesResponse])

  useEffect(() => {
    setUserDepartmentsByUserId(membershipsByUserId)
  }, [membershipsByUserId])

  useEffect(() => {
    if (!isAdmin) return
    setPage(1)
  }, [isAdmin])

  const departmentNameById = (departmentId: string) => {
    return departments.find((d) => d.id === departmentId)?.name || departmentId
  }

  const getUserDepartmentNames = (userId: string, profileDepartmentId?: string | null) => {
    const fromMemberships = userDepartmentsByUserId[userId] || []
    const ids = profileDepartmentId ? Array.from(new Set([profileDepartmentId, ...fromMemberships])) : fromMemberships
    return ids.map(departmentNameById).filter(Boolean)
  }

  const editSystemRoles = (() => {
    const order = ["super-admin", "admin", SYSTEM_ADMIN_ROLE_NAME, "user"]
    const allowed = new Set(order)

    const options = roles
      .filter((role) => allowed.has(role.name))
      .map((role) => ({ id: role.id, name: role.name }))
      .filter((opt, idx, all) => all.findIndex((x) => x.id === opt.id) === idx)

    if (!options.some((r) => r.id === USER_ROLE_ID)) {
      options.push({ id: USER_ROLE_ID, name: "user" })
    }

    if (!options.some((r) => r.id === ADMIN_ROLE_ID)) {
      options.push({ id: ADMIN_ROLE_ID, name: "admin" })
    }

    if (!options.some((r) => r.id === SUPER_ADMIN_ROLE_ID)) {
      options.push({ id: SUPER_ADMIN_ROLE_ID, name: "super-admin" })
    }

    if (!options.some((r) => r.id === SYSTEM_ADMIN_ROLE_ID)) {
      options.push({ id: SYSTEM_ADMIN_ROLE_ID, name: SYSTEM_ADMIN_ROLE_NAME })
    }

    return options.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  })()


  const pageSize = 6;

  const clampPage = (requestedPage: number, total: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return Math.min(Math.max(1, requestedPage), totalPages);
  };

  const paginate = <T,>(items: T[], requestedPage: number) => {
    const total = items.length;
    const safePage = clampPage(requestedPage, total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = (safePage - 1) * pageSize;
    const endIndexExclusive = Math.min(startIndex + pageSize, total);

    return {
      page: safePage,
      total,
      totalPages,
      start: total === 0 ? 0 : startIndex + 1,
      end: total === 0 ? 0 : endIndexExclusive,
      pageItems: items.slice(startIndex, endIndexExclusive),
    };
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const departmentNames = getUserDepartmentNames(user.id, user.profile?.department_id)
    const matchesSearch = 
      user.profile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (departmentNames.length > 0 && departmentNames.join(" ").toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === "all" || user.profile?.role_id === roleFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && user.profile?.is_active) ||
      (statusFilter === "inactive" && !user.profile?.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const pagination = paginate(filteredUsers, page);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    const nextPage = clampPage(page, filteredUsers.length);
    if (nextPage !== page) setPage(nextPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredUsers.length]);

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

    const prevUsersResponse = usersResponse
    const nowIso = new Date().toISOString()
    const tempId = `temp-${Date.now()}`
    const roleName = roles.find((r) => r.id === createUserForm.role_id)?.name || "user"

    const optimisticUser: AdminUsersApiUser = {
      id: tempId,
      email: createUserForm.email.trim().toLowerCase(),
      email_confirmed_at: nowIso,
      created_at: nowIso,
      profile: {
        id: tempId,
        name: createUserForm.name.trim(),
        department_id: null,
        role_id: createUserForm.role_id,
        role_name: roleName,
        is_active: true,
        created_at: nowIso,
        last_login: null,
      },
    }

    mutateUsers(
      (current) => {
        if (!current) return { data: [optimisticUser] }
        const next = [optimisticUser, ...(Array.isArray(current.data) ? current.data : [])]
        return { ...current, data: next }
      },
      { revalidate: false },
    )

    try {
      // Create user via API endpoint (uses admin client server-side)
      const created = await apiFetch<AdminCreateUserResponse>('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createUserForm.email,
          password: createUserForm.password,
          name: createUserForm.name.trim(),
          role_id: createUserForm.role_id,
        }),
      });

      const createdRoleName = roles.find((r) => r.id === created.profile.role_id)?.name || roleName
      const createdUser: AdminUsersApiUser = {
        id: created.user.id,
        email: created.user.email || optimisticUser.email,
        email_confirmed_at: nowIso,
        created_at: created.user.created_at || nowIso,
        profile: {
          id: created.profile.id,
          name: created.profile.name,
          department_id: created.profile.department_id,
          role_id: created.profile.role_id,
          role_name: createdRoleName,
          is_active: created.profile.is_active,
          created_at: created.profile.created_at,
          last_login: created.profile.last_login || null,
        },
      }

      mutateUsers(
        (current) => {
          if (!current) return { data: [createdUser] }
          const rows = Array.isArray(current.data) ? current.data : []
          const replaced = rows.map((u) => (u.id === tempId ? createdUser : u))
          const withoutTemp = replaced.filter((u) => u.id !== tempId)
          const hasReal = withoutTemp.some((u) => u.id === createdUser.id)
          const next = hasReal ? withoutTemp : [createdUser, ...withoutTemp]
          return { ...current, data: next }
        },
        { revalidate: false },
      )

      // Reset form
      setCreateUserForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role_id: USER_ROLE_ID,
      });
      setFormErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowCreateUser(false);

      toast.success("User created successfully");
      mutateUsers()
      mutateMemberships()
    } catch (error: any) {
      if (prevUsersResponse) {
        mutateUsers(prevUsersResponse, { revalidate: false })
      } else {
        mutateUsers()
      }
      console.error("Failed to create user:", error);
      toast.error(getErrorMessage(error, "Failed to create user"))
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

    if (!editUserForm.role_id) {
      errors.role_id = "Role is required";
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateUser = async () => {
    if (!validateEditUserForm() || !editingUser || isUpdatingUser) return;

    setIsUpdatingUser(true);

    const prevUsersResponse = usersResponse
    const nextName = editUserForm.name.trim()
    const nextEmail = editUserForm.email.trim().toLowerCase()
    const nextRoleId = editUserForm.role_id
    const nextRoleName = roles.find((r) => r.id === nextRoleId)?.name || "user"
    const nextIsActive = editUserForm.is_active

    mutateUsers(
      (current) => {
        if (!current) return current
        const rows = Array.isArray(current.data) ? current.data : []
        const nextRows = rows.map((u) => {
          if (u.id !== editingUser.id) return u
          return {
            ...u,
            email: nextEmail,
            profile: {
              ...u.profile,
              name: nextName,
              role_id: nextRoleId,
              role_name: nextRoleName,
              is_active: nextIsActive,
            },
          }
        })
        return { ...current, data: nextRows }
      },
      { revalidate: false },
    )

    try {
      // Check if we need to mark email as verified or unverified
      const shouldMarkEmailVerified = editUserForm.email_verified && !editingUser.email_confirmed_at;
      const shouldUnmarkEmailVerified = !editUserForm.email_verified && editingUser.email_confirmed_at && isSuperAdmin;
      
      // Update user details
      await apiFetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: editingUser.id,
          name: editUserForm.name.trim(),
          email: editUserForm.email.trim().toLowerCase(),
          role_id: editUserForm.role_id,
          is_active: editUserForm.is_active,
        }),
      });

      toast.success("User updated successfully");
      
      // Mark email as verified if requested
      if (shouldMarkEmailVerified) {
        try {
          await apiFetch('/api/admin/users/mark-email-verified', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: editingUser.id,
            }),
          });

          mutateUsers(
            (current) => {
              if (!current) return current
              const rows = Array.isArray(current.data) ? current.data : []
              const nextRows = rows.map((u) =>
                u.id === editingUser.id ? { ...u, email_confirmed_at: new Date().toISOString() } : u,
              )
              return { ...current, data: nextRows }
            },
            { revalidate: false },
          )
          
          // Update the editingUser state to reflect the new email verification status
          if (editingUser) {
            setEditingUser({
              ...editingUser,
              email_confirmed_at: new Date().toISOString()
            });
          }
          
          toast.success(`Email for ${editUserForm.name || editUserForm.email} marked as verified`);
        } catch (verifyError: any) {
          console.error("Failed to mark email as verified:", verifyError);
          toast.error(getErrorMessage(verifyError, "Failed to mark email as verified"))
        }
      }
      
      // Unmark email as verified if requested (superadmin only)
      if (shouldUnmarkEmailVerified) {
        try {
          await apiFetch('/api/admin/users/unmark-email-verified', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: editingUser.id,
            }),
          });

          mutateUsers(
            (current) => {
              if (!current) return current
              const rows = Array.isArray(current.data) ? current.data : []
              const nextRows = rows.map((u) =>
                u.id === editingUser.id ? { ...u, email_confirmed_at: null } : u,
              )
              return { ...current, data: nextRows }
            },
            { revalidate: false },
          )
          
          // Update the editingUser state to reflect the new email verification status
          if (editingUser) {
            setEditingUser({
              ...editingUser,
              email_confirmed_at: null
            });
          }
          
          toast.success(`Email for ${editUserForm.name || editUserForm.email} unmarked as verified`);
        } catch (unverifyError: any) {
          console.error("Failed to unmark email as verified:", unverifyError);
          toast.error(getErrorMessage(unverifyError, "Failed to unmark email as verified"))
        }
      }
      
      setShowEditUser(false);
      setEditingUser(null);
      setEditFormErrors({});
      mutateUsers()
      mutateMemberships()
    } catch (error: any) {
      if (prevUsersResponse) {
        mutateUsers(prevUsersResponse, { revalidate: false })
      } else {
        mutateUsers()
      }
      console.error("Failed to update user:", error);
      toast.error(getErrorMessage(error, "Failed to update user"))
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

    const prevUsersResponse = usersResponse
    const nextIsActive = !user.profile.is_active

    mutateUsers(
      (current) => {
        if (!current) return current
        const rows = Array.isArray(current.data) ? current.data : []
        const nextRows = rows.map((u) => {
          if (u.id !== user.id) return u
          return {
            ...u,
            profile: {
              ...u.profile,
              is_active: nextIsActive,
            },
          }
        })
        return { ...current, data: nextRows }
      },
      { revalidate: false },
    )

    try {
      await apiFetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          is_active: !user.profile.is_active,
        }),
      });

      toast.success(`User ${user.profile.is_active ? "deactivated" : "activated"} successfully`);
      mutateUsers()
    } catch (error: any) {
      if (prevUsersResponse) {
        mutateUsers(prevUsersResponse, { revalidate: false })
      } else {
        mutateUsers()
      }
      console.error("Failed to update user status:", error);
      toast.error(getErrorMessage(error, "Failed to update user status"))
    } finally {
      // Clear loading state
      setTogglingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Type assert userToDelete as UserWithProfile with proper type safety
    const user = userToDelete as unknown as UserWithProfile;

    if (user.id === currentUser?.id) {
      toast.error("You cannot delete your own account");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      return;
    }

    // Prevent deleting admin accounts for non-super admins
    const userRoleId = user.profile?.role_id;
    const isCurrentUserSuperAdmin = currentProfile?.role_id === SUPER_ADMIN_ROLE_ID;
    
    if ((userRoleId === ADMIN_ROLE_ID || userRoleId === SYSTEM_ADMIN_ROLE_ID || userRoleId === SUPER_ADMIN_ROLE_ID) && !isCurrentUserSuperAdmin) {
      toast.error("You do not have permission to delete admin accounts");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      return;
    }

    const prevUsersResponse = usersResponse

    try {
      mutateUsers(
        (current) => {
          if (!current) return current
          const rows = Array.isArray(current.data) ? current.data : []
          return { ...current, data: rows.filter((u) => u.id !== userToDelete.id) }
        },
        { revalidate: false },
      )

      // Call the API to delete the user
      await apiFetch(`/api/admin/users?user_id=${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      toast.success("User deleted successfully");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      mutateUsers()
      mutateMemberships()
    } catch (error: any) {
      if (prevUsersResponse) {
        mutateUsers(prevUsersResponse, { revalidate: false })
      } else {
        mutateUsers()
      }
      console.error("Failed to delete user:", error);
      toast.error(getErrorMessage(error, "Failed to delete user"))
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;

    setResettingPassword(true);

    try {
      if (resetPasswordMode === "email") {
        // Send password reset email
        await apiFetch('/api/admin/users/reset-password', {
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

        await apiFetch('/api/admin/users/reset-password', {
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

        toast.success("Password reset successfully");
        setNewPassword("");
        setConfirmNewPassword("");
      }

      setShowResetPasswordDialog(false);
      setUserToResetPassword(null);
      setResetPasswordMode("email");
    } catch (error: any) {
      console.error("Failed to reset password:", error);
      toast.error(getErrorMessage(error, "Failed to reset password"))
    } finally {
      setResettingPassword(false);
    }
  };

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case "super-admin": return "destructive";
      case "admin": return "destructive";
      case "system-admin": return "default";
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <UsersTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex sm:justify-end pb-4">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => Promise.all([mutateUsers(), mutateRoles(), mutateDepartments(), mutateMemberships()])}
            variant="outline"
            size="sm"
            disabled={isUsersValidating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isUsersValidating ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateUser(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
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
                <SelectItem value={SYSTEM_ADMIN_ROLE_ID}>System Admin</SelectItem>
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
          <DataTable
            isLoading={isLoading}
            isEmpty={filteredUsers.length === 0}
            loadingFallback={
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
            emptyFallback={<div className="text-center py-12 text-muted-foreground">No users found</div>}
          >
            <div className="overflow-x-auto">
              <div className="min-w-full inline-block align-middle">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((user) => (
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
                            <button
                              type="button"
                              onClick={async () => {
                                if (!user.email || user.email === "N/A") return
                                try {
                                  await navigator.clipboard.writeText(user.email)
                                  toast.success("Email copied to clipboard")
                                } catch (error) {
                                  console.error("Failed to copy email", error)
                                  toast.error("Failed to copy email")
                                }
                              }}
                              className="text-muted-foreground hover:text-foreground text-sm"
                            >
                              {user.email}
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const names = getUserDepartmentNames(user.id, user.profile?.department_id)
                          if (names.length === 0) return "-"
                          return names.join(", ")
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.profile?.role_name || "user")}>
                          {user.profile?.role_name || "user"}
                        </Badge>
                      </TableCell>
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
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingUser(user)
                              setEditUserForm({
                                name: user.profile?.name || "",
                                email: user.email,
                                role_id: user.profile?.role_id || USER_ROLE_ID,
                                is_active: user.profile?.is_active ?? true,
                                email_verified: !!user.email_confirmed_at,
                              })
                              setShowEditUser(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit user</span>
                          </Button>

                          <ActionMenu
                            trigger={
                              <Button variant="outline" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">More actions</span>
                              </Button>
                            }
                            contentClassName="w-52"
                            items={[
                              {
                                type: "item",
                                label: user.profile?.is_active ? "Deactivate" : "Activate",
                                icon:
                                  togglingUserId === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : user.profile?.is_active ? (
                                    <Lock className="h-4 w-4" />
                                  ) : (
                                    <Unlock className="h-4 w-4" />
                                  ),
                                onSelect: () => {
                                  if (togglingUserId === user.id) return
                                  handleToggleUserStatus(user)
                                },
                                disabled: user.id === currentUser?.id || togglingUserId === user.id,
                                title:
                                  user.id === currentUser?.id
                                    ? "You cannot change your own status"
                                    : user.profile?.is_active
                                      ? "Deactivate user"
                                      : "Activate user",
                              },
                              {
                                type: "item",
                                label: "Reset password",
                                icon: <Key className="h-4 w-4" />,
                                onSelect: () => {
                                  setUserToResetPassword(user)
                                  setResetPasswordMode("email")
                                  setNewPassword("")
                                  setConfirmNewPassword("")
                                  setShowResetPasswordDialog(true)
                                },
                              },
                              { type: "separator" },
                              {
                                type: "item",
                                label: "Delete user",
                                icon: <Trash2 className="h-4 w-4" />,
                                destructive: true,
                                onSelect: () => {
                                  setUserToDelete(user)
                                  setShowDeleteDialog(true)
                                },
                                disabled:
                                  user.id === currentUser?.id ||
                                  user.profile?.role_id === ADMIN_ROLE_ID ||
                                  user.profile?.role_id === SYSTEM_ADMIN_ROLE_ID ||
                                  user.profile?.role_id === SUPER_ADMIN_ROLE_ID,
                                title:
                                  user.id === currentUser?.id
                                    ? "You cannot delete your own account"
                                    : user.profile?.role_id === ADMIN_ROLE_ID ||
                                        user.profile?.role_id === SYSTEM_ADMIN_ROLE_ID ||
                                        user.profile?.role_id === SUPER_ADMIN_ROLE_ID
                                      ? "Cannot delete admin accounts"
                                      : "Delete user",
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6">
              <div className="hidden sm:block">
                <p className="text-muted-foreground text-sm">
                  Showing <span className="text-foreground font-medium">{pagination.start}</span> to{" "}
                  <span className="text-foreground font-medium">{pagination.end}</span> of{" "}
                  <span className="text-foreground font-medium">{pagination.total}</span> results
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.total === 0 || pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Prev
                </Button>

                <div className="hidden items-center gap-1 sm:flex">
                  {Array.from({ length: pagination.totalPages }).map((_, i) => {
                    const p = i + 1;
                    const active = p === pagination.page;
                    return (
                      <Button
                        key={`user-page-${p}`}
                        variant="outline"
                        size="sm"
                        disabled={pagination.total === 0}
                        className={active ? "border-primary bg-primary/10 text-primary" : ""}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.total === 0 || pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>

          </DataTable>
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
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={createUserForm.role_id}
                onValueChange={(value) => {
                  setCreateUserForm(prev => ({ 
                    ...prev, 
                    role_id: value,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {editSystemRoles.map((role) => (
                    <SelectItem 
                      key={role.id} 
                      value={role.id}
                      disabled={!isSuperAdmin && role.id === SUPER_ADMIN_ROLE_ID}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{role.name.replace(/-/g, ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <RightSidePanel
        open={showEditUser}
        onOpenChange={(open) => {
          setShowEditUser(open)
          if (!open) {
            setEditingUser(null)
            setEditFormErrors({})
          }
        }}
        title={editingUser?.profile?.name || "Edit User"}
        description={editingUser?.email || "Update user information and settings."}
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!editingUser) return
                  setUserToResetPassword(editingUser)
                  setShowResetPasswordDialog(true)
                }}
                disabled={!editingUser}
              >
                Reset Password
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!editingUser) return
                  setUserToDelete(editingUser)
                  setShowDeleteDialog(true)
                }}
                disabled={!editingUser}
              >
                Delete
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditUser(false)
                  setEditingUser(null)
                  setEditFormErrors({})
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
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={editUserForm.name}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
            />
            {editFormErrors.name && <p className="text-sm text-destructive">{editFormErrors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={editUserForm.email}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
            {editFormErrors.email && <p className="text-sm text-destructive">{editFormErrors.email}</p>}
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="email-verified"
                checked={editUserForm.email_verified}
                onCheckedChange={(checked) => setEditUserForm((prev) => ({ ...prev, email_verified: checked }))}
                disabled={!!editingUser && editingUser.email_confirmed_at !== null && !isSuperAdmin}
              />
              <Label htmlFor="email-verified">Email Verified</Label>
            </div>
            {editingUser?.email_confirmed_at && (
              <span className="text-xs text-muted-foreground">
                Verified: {new Date(editingUser.email_confirmed_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editUserForm.role_id}
                onValueChange={(value) => setEditUserForm((prev) => ({ ...prev, role_id: value }))}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {editSystemRoles
                    .filter((role) => isSuperAdmin || role.id !== SUPER_ADMIN_ROLE_ID)
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {editFormErrors.role_id && <p className="text-sm text-destructive">{editFormErrors.role_id}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="edit-is-active"
              checked={editUserForm.is_active}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="edit-is-active">Active</Label>
          </div>
        </div>
      </RightSidePanel>

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
