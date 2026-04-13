// Unified Membership System Types
// Phase 3: Frontend type definitions for the unified membership model

export interface Role {
  id: string;
  type: "profession" | "access_level";
  scope: "department" | "system";
  name: string;
  display_name: string;
  description?: string;
  department_id?: string;
  level?: number;
  sort_order?: number;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  department_id: string;
  membership_type: "profession" | "access_level";
  role_id: string;
  is_active: boolean;
  is_primary: boolean;
  last_used_at?: string;
  deactivated_at?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  role: Role;
  user?: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}

export interface MembershipAuditLog {
  id: string;
  user_id: string;
  from_department_id?: string;
  to_department_id?: string;
  membership_type?: "profession" | "access_level";
  role_id?: string;
  action: "moved" | "activated" | "deactivated" | "created" | "primary_assigned" | "primary_removed" | "primary_auto_promoted";
  reason?: string;
  performed_by?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateMembershipRequest {
  user_id: string;
  role_id: string;
  membership_type: "profession" | "access_level";
  is_active?: boolean;
}

export interface MoveMembershipRequest {
  action: "move";
  user_id: string;
  target_department_id: string;
  new_role?: string;
  reason?: string;
  last_updated_at?: string;
}

export interface UpdateMembershipRequest {
  is_active?: boolean;
  is_primary?: boolean;
  reason?: string;
  last_updated_at?: string;
}

export interface PaginatedMembershipResponse {
  data: Membership[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Helper type for badge variants
export type MembershipBadgeVariant = "profession" | "access_level" | "primary";

// Helper functions
export function getMembershipBadgeVariant(membership: Membership): MembershipBadgeVariant {
  if (membership.is_primary) return "primary";
  return membership.membership_type;
}

export function getMembershipDisplayName(membership: Membership): string {
  return membership.role?.display_name || membership.role?.name || "Unknown";
}

export function isProfessionMembership(membership: Membership): boolean {
  return membership.membership_type === "profession";
}

export function isAccessLevelMembership(membership: Membership): boolean {
  return membership.membership_type === "access_level";
}
