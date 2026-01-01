"use client";

import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { useSupabaseRbac } from "@/hooks/use-supabase-rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Department {
  id: string
  name: string
}

export default function ProfilePage() {
  const { user, profile, updateProfile, logout, isLoading } = useSupabaseAuth();
  const { permissions } = useSupabaseRbac();
  
  const [name, setName] = useState(profile?.name || "");
  const [departmentId, setDepartmentId] = useState(profile?.department_id || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true)
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) throw error
        setDepartments((data || []) as Department[])
      } catch {
        setDepartments([])
      } finally {
        setLoadingDepartments(false)
      }
    }

    loadDepartments()
  }, [])

  // Function to update user profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsUpdating(true);
    try {
      await updateProfile({
        name,
        department_id: departmentId || null,
      });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-10">
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
    );
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and account settings
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>

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
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Your email address cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId} disabled={loadingDepartments}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder={loadingDepartments ? "Loading departments..." : "Select department"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <h3 className="font-medium">Account ID</h3>
                <p className="text-sm text-muted-foreground break-all">{user?.id}</p>
              </div>
              
              <div>
                <h3 className="font-medium">Role</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {profile?.role_id === "00000000-0000-0000-0000-000000000001" ? "Admin" : "User"}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">Permissions</h3>
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
                    <p className="text-sm text-muted-foreground">No specific permissions assigned</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
