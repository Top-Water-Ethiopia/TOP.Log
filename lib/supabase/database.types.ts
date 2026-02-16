export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          message: string | null
          requested_role: string | null
          requester_email: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          message?: string | null
          requested_role?: string | null
          requester_email?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          message?: string | null
          requested_role?: string | null
          requester_email?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changes: Json | null
          entity_id: string
          id: string
          metadata: Json | null
          operation: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          changes?: Json | null
          entity_id: string
          id?: string
          metadata?: Json | null
          operation: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          changes?: Json | null
          entity_id?: string
          id?: string
          metadata?: Json | null
          operation?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      captain_log_entries: {
        Row: {
          created_at: string | null
          date: string
          department_id: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          department_id?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          department_id?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_log_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_responses: {
        Row: {
          entry_id: string
          id: string
          question_category: string | null
          question_id: string
          question_key: string
          question_label: string
          question_type: string
          timestamp: string | null
          value: Json | null
        }
        Insert: {
          entry_id: string
          id?: string
          question_category?: string | null
          question_id: string
          question_key: string
          question_label: string
          question_type: string
          timestamp?: string | null
          value?: Json | null
        }
        Update: {
          entry_id?: string
          id?: string
          question_category?: string | null
          question_id?: string
          question_key?: string
          question_label?: string
          question_type?: string
          timestamp?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_responses_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "captain_log_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      department_access_level_permissions: {
        Row: {
          access_level_id: string
          created_at: string
          effect: string
          id: string
          permission_definition_id: string
          updated_at: string
        }
        Insert: {
          access_level_id: string
          created_at?: string
          effect?: string
          id?: string
          permission_definition_id: string
          updated_at?: string
        }
        Update: {
          access_level_id?: string
          created_at?: string
          effect?: string
          id?: string
          permission_definition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_access_level_permissions_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "department_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_access_level_perm_def_fk"
            columns: ["permission_definition_id"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      department_access_levels: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          level: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_roles: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          is_active: boolean
          is_default: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          is_active?: boolean
          is_default?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          is_active?: boolean
          is_default?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permission_definitions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          resource: string
          scope: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          resource: string
          scope?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          resource?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          conditions: Json | null
          created_at: string
          id: string
          resource: string
          role_id: string
          updated_at: string
        }
        Insert: {
          action: string
          conditions?: Json | null
          created_at?: string
          id?: string
          resource: string
          role_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          conditions?: Json | null
          created_at?: string
          id?: string
          resource?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_questions: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          department_role: string | null
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          max_date: string | null
          max_length: number | null
          max_value: number | null
          metadata: Json | null
          min_date: string | null
          min_length: number | null
          min_value: number | null
          options: Json | null
          pattern: string | null
          placeholder: string | null
          question_description: string | null
          question_label: string
          question_type: string
          step: number | null
          updated_at: string
          updated_by: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_role?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_date?: string | null
          max_length?: number | null
          max_value?: number | null
          metadata?: Json | null
          min_date?: string | null
          min_length?: number | null
          min_value?: number | null
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          question_description?: string | null
          question_label: string
          question_type: string
          step?: number | null
          updated_at?: string
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_role?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_date?: string | null
          max_length?: number | null
          max_value?: number | null
          metadata?: Json | null
          min_date?: string | null
          min_length?: number | null
          min_value?: number | null
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          question_description?: string | null
          question_label?: string
          question_type?: string
          step?: number | null
          updated_at?: string
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "role_questions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          level?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_access_levels: {
        Row: {
          access_level_id: string
          assigned_by: string | null
          created_at: string
          department_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level_id: string
          assigned_by?: string | null
          created_at?: string
          department_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level_id?: string
          assigned_by?: string | null
          created_at?: string
          department_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_access_levels_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "department_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_access_levels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_professions: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          is_active: boolean
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          is_active?: boolean
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          is_active?: boolean
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_professions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_professions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_roles: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          is_active?: boolean
          role: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "department_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          last_login: string | null
          metadata: Json | null
          name: string
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          metadata?: Json | null
          name: string
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          metadata?: Json | null
          name?: string
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_user_role: {
        Row: {
          is_active: boolean | null
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          is_active?: boolean | null
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          is_active?: boolean | null
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_department: {
        Args: { p_department_id: string }
        Returns: boolean
      }
      can_view_department_questions: {
        Args: { p_department_id: string }
        Returns: boolean
      }
      can_view_entry: {
        Args: { p_department_id: string; p_target_user_id: string }
        Returns: boolean
      }
      can_view_user_entries: {
        Args: { p_target_user_id: string }
        Returns: boolean
      }
      can_view_user_profile: {
        Args: { p_target_user_id: string }
        Returns: boolean
      }
      create_report_questions_table_if_not_exists: {
        Args: never
        Returns: undefined
      }
      diagnose_is_admin: {
        Args: never
        Returns: {
          current_user_id: string
          final_result: boolean
          is_active: boolean
          is_admin_role: boolean
          role_id: string
          user_exists: boolean
        }[]
      }
      get_current_user_role: {
        Args: never
        Returns: {
          is_active: boolean
          name: string
          role_id: string
          user_id: string
        }[]
      }
      get_users_with_emails: {
        Args: never
        Returns: {
          created_at: string
          department: string
          email: string
          is_active: boolean
          last_login: string
          name: string
          profile_created_at: string
          role_id: string
          role_name: string
          user_id: string
        }[]
      }
      has_department_role: {
        Args: { p_department_id: string; p_roles: string[] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_super_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_admin_v2: { Args: never; Returns: boolean }
      test_user_role: {
        Args: never
        Returns: {
          is_active: boolean
          role_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
