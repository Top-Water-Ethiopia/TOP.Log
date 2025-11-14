import { supabase } from './supabase-client';
import type { Database } from './supabase.types';
import { PostgrestError } from '@supabase/supabase-js';

// Type definitions
export type Role = Database['public']['Tables']['roles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// RBAC constants
export const ROLE_HIERARCHY = {
  admin: ['admin', 'user'],
  user: ['user'],
};

// User permission check params
export interface PermissionParams {
  resource: string;
  action: string;
  ownResource?: boolean;
}

// Error handling
class RBACError extends Error {
  code: string;

  constructor(message: string, code: string = 'rbac_error') {
    super(message);
    this.name = 'RBACError';
    this.code = code;
  }
}

// Handle Supabase errors
const handleSupabaseError = (error: PostgrestError): never => {
  console.error('Supabase RBAC error:', error);
  throw new RBACError(error.message, error.code || 'unknown_error');
};

/**
 * Get all roles from the database
 */
export async function getRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');

  if (error) handleSupabaseError(error);
  return data as Role[];
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    handleSupabaseError(error);
  }
  
  return data as Role;
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    handleSupabaseError(error);
  }
  
  return data as Role;
}

/**
 * Get all permissions for a role
 */
export async function getPermissionsByRoleId(roleId: string) {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('role_id', roleId);

  if (error) handleSupabaseError(error);
  return data as Permission[];
}

/**
 * Get user profile with role information
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    handleSupabaseError(error);
  }
  
  return data as UserProfile & { roles: Role };
}

/**
 * Check if a user has permission to perform an action on a resource
 */
export async function checkPermission(userId: string, params: PermissionParams): Promise<boolean> {
  try {
    // Get user profile with role info
    const userProfile = await getUserProfile(userId);
    if (!userProfile) return false;

    const roleId = userProfile.role_id;
    
    // Get all permissions for this role
    const permissions = await getPermissionsByRoleId(roleId);
    
    // Check if there's a matching permission
    const hasPermission = permissions.some(p => 
      p.resource === params.resource && 
      p.action === params.action
    );
    
    // If requesting own resource permission, check if user owns the resource
    if (params.ownResource) {
      // This would typically check if the resource belongs to the user
      // For now, we'll assume true in this example
      return hasPermission;
    }
    
    return hasPermission;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    // Get user profile with role
    const userProfile = await getUserProfile(userId);
    if (!userProfile) return [];

    // Get permissions for the role
    return await getPermissionsByRoleId(userProfile.role_id);
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, roleId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      role_id: roleId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) handleSupabaseError(error);
  return data;
}
