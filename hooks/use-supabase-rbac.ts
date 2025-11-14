"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import * as rbac from "@/lib/supabase-rbac";
import type { Permission, PermissionParams } from "@/lib/supabase-rbac";

export function useSupabaseRbac() {
  const { user, profile } = useSupabaseAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (!user || !profile) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const userPermissions = await rbac.getUserPermissions(user.id);
        setPermissions(userPermissions);
        setError(null);
      } catch (err) {
        console.error("Failed to load permissions:", err);
        setError(err instanceof Error ? err : new Error("Failed to load permissions"));
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [user, profile]);

  // Check if user has a specific permission
  const canPerformAction = useCallback(
    (params: PermissionParams, resourceOwnerId?: string) => {
      if (!user || !permissions.length) return false;

      // If checking own resource, verify ownership
      if (params.ownResource && resourceOwnerId) {
        const isOwner = resourceOwnerId === user.id;
        if (!isOwner) return false;
      }

      // Check permission
      return permissions.some(
        (p) => p.resource === params.resource && p.action === params.action
      );
    },
    [user, permissions]
  );

  // Check if user has a specific role
  const hasRole = useCallback(
    (roleName: string) => {
      if (!profile?.role_id) return false;
      
      // This is a simplified check - in a full implementation
      // we would fetch the role by ID and check its name
      return profile.role_id === roleName;
    },
    [profile]
  );

  // Update user role
  const updateUserRole = useCallback(
    async (userId: string, roleId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if user has permission to update roles
      if (!canPerformAction({ resource: "users", action: "update" })) {
        throw new Error("Insufficient permissions to update user roles");
      }

      try {
        await rbac.updateUserRole(userId, roleId);
      } catch (err) {
        console.error("Failed to update user role:", err);
        throw err;
      }
    },
    [user, canPerformAction]
  );

  return {
    permissions,
    canPerformAction,
    hasRole,
    updateUserRole,
    isLoading,
    error,
  };
}
