// Temporary type definitions for new department access level tables
// These will be replaced by auto-generated types after running supabase gen types

export interface PermissionDefinition {
  id: string
  resource: string
  action: string
  description?: string | null
  scope: "system" | "department" | "both"
  created_at: string
  updated_at: string
}

export interface DepartmentAccessLevel {
  id: string
  name: string
  display_name: string
  description?: string | null
  level: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

export interface DepartmentAccessLevelPermission {
  id: string
  access_level_id: string
  permission_definition_id: string
  effect: string
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  // Join fields (populated when querying with join)
  permission_definition?: PermissionDefinition
}

export interface UserDepartmentAccessLevel {
  id: string
  user_id: string
  department_id: string
  access_level_id: string
  assigned_by?: string | null
  created_at: string
  updated_at: string
}

// Extended Supabase client types
declare module "@supabase/supabase-js" {
  interface Database {
    public: {
      Tables: {
        permission_definitions: {
          Row: PermissionDefinition
          Insert: Omit<PermissionDefinition, "id" | "created_at" | "updated_at">
          Update: Partial<Omit<PermissionDefinition, "id" | "created_at" | "updated_at">>
        }
        department_access_levels: {
          Row: DepartmentAccessLevel
          Insert: Omit<DepartmentAccessLevel, "id" | "created_at" | "updated_at">
          Update: Partial<Omit<DepartmentAccessLevel, "id" | "created_at" | "updated_at">>
        }
        department_access_level_permissions: {
          Row: DepartmentAccessLevelPermission
          Insert: Omit<DepartmentAccessLevelPermission, "id" | "created_at" | "updated_at" | "permission_definition">
          Update: Partial<
            Omit<DepartmentAccessLevelPermission, "id" | "created_at" | "updated_at" | "permission_definition">
          >
        }
        user_department_access_levels: {
          Row: UserDepartmentAccessLevel
          Insert: Omit<UserDepartmentAccessLevel, "id" | "created_at" | "updated_at">
          Update: Partial<Omit<UserDepartmentAccessLevel, "id" | "created_at" | "updated_at">>
        }
      }
    }
  }
}
