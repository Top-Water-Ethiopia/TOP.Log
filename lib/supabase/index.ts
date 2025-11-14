// Export everything related to Supabase from a single file
export * from '../supabase-client';
export * from '../supabase.types';
export * from '../supabase-data';
export * from '../supabase-rbac';
export * from '../auth-utils';

// Also export utility functions
export * from '../test-supabase';

// Type aliases for convenience
import type { Database } from '../supabase.types';

// Tables
export type Tables = Database['public']['Tables'];
export type TableName = keyof Database['public']['Tables'];

// Captain Log Entries
export type CaptainLogEntryRow = Tables['captain_log_entries']['Row'];
export type CaptainLogEntryInsert = Tables['captain_log_entries']['Insert'];
export type CaptainLogEntryUpdate = Tables['captain_log_entries']['Update'];

// Custom Responses
export type CustomResponseRow = Tables['custom_responses']['Row'];
export type CustomResponseInsert = Tables['custom_responses']['Insert'];
export type CustomResponseUpdate = Tables['custom_responses']['Update'];

// Audit Logs
export type AuditLogRow = Tables['audit_logs']['Row'];
export type AuditLogInsert = Tables['audit_logs']['Insert'];
export type AuditLogUpdate = Tables['audit_logs']['Update'];

// Roles
export type RoleRow = Tables['roles']['Row'];
export type RoleInsert = Tables['roles']['Insert'];
export type RoleUpdate = Tables['roles']['Update'];

// Permissions
export type PermissionRow = Tables['permissions']['Row'];
export type PermissionInsert = Tables['permissions']['Insert'];
export type PermissionUpdate = Tables['permissions']['Update'];

// User Profiles
export type UserProfileRow = Tables['user_profiles']['Row'];
export type UserProfileInsert = Tables['user_profiles']['Insert'];
export type UserProfileUpdate = Tables['user_profiles']['Update'];
