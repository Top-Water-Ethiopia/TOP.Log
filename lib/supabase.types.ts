export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Industry standard: follow Supabase generated types pattern
export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          code: string | null
          is_active: boolean
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          code?: string | null
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          code?: string | null
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      captain_log_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          department_id: string | null
          entry_kind: string
          submitted_by_user_id: string | null
          report_kind: string
          subject_agent_id: string | null
          subject_agent_snapshot: Json | null
          subject_department_id: string | null
          subject_profession_id: string | null
          created_at: string
          updated_at: string
          version: number
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          department_id?: string | null
          entry_kind?: string
          submitted_by_user_id?: string | null
          report_kind?: string
          subject_agent_id?: string | null
          subject_agent_snapshot?: Json | null
          subject_department_id?: string | null
          subject_profession_id?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          department_id?: string | null
          entry_kind?: string
          submitted_by_user_id?: string | null
          report_kind?: string
          subject_agent_id?: string | null
          subject_agent_snapshot?: Json | null
          subject_department_id?: string | null
          subject_profession_id?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_log_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_log_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_log_entries_subject_agent_id_fkey"
            columns: ["subject_agent_id"]
            isOneToOne: false
            referencedRelation: "marketing_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_log_entries_subject_department_id_fkey"
            columns: ["subject_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_log_entries_subject_profession_id_fkey"
            columns: ["subject_profession_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_responses: {
        Row: {
          id: string
          entry_id: string
          question_id: string
          question_key: string
          question_label: string | null
          question_type: string | null
          question_category: string | null
          value: Json
          timestamp: string
        }
        Insert: {
          id?: string
          entry_id: string
          question_id: string
          question_key: string
          question_label?: string | null
          question_type?: string | null
          question_category?: string | null
          value: Json
          timestamp?: string
        }
        Update: {
          id?: string
          entry_id?: string
          question_id?: string
          question_key?: string
          question_label?: string | null
          question_type?: string | null
          question_category?: string | null
          value?: Json
          timestamp?: string
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
      audit_logs: {
        Row: {
          id: string
          timestamp: string
          operation: string
          entity_id: string
          changes: Json | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          id?: string
          timestamp?: string
          operation: string
          entity_id: string
          changes?: Json | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          id?: string
          timestamp?: string
          operation?: string
          entity_id?: string
          changes?: Json | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          type: "profession" | "access_level"
          scope: "department" | "system"
          department_id: string | null
          name: string
          display_name: string
          description: string | null
          level: number | null
          sort_order: number | null
          is_active: boolean
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: "profession" | "access_level"
          scope?: "department" | "system"
          department_id?: string | null
          name: string
          display_name: string
          description?: string | null
          level?: number | null
          sort_order?: number | null
          is_active?: boolean
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: "profession" | "access_level"
          scope?: "department" | "system"
          department_id?: string | null
          name?: string
          display_name?: string
          description?: string | null
          level?: number | null
          sort_order?: number | null
          is_active?: boolean
          is_default?: boolean
          created_at?: string
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
      user_department_memberships: {
        Row: {
          id: string
          user_id: string
          department_id: string
          membership_type: "profession" | "access_level"
          role_id: string
          is_active: boolean
          is_primary: boolean
          last_used_at: string | null
          deactivated_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          department_id: string
          membership_type: "profession" | "access_level"
          role_id: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          deactivated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          department_id?: string
          membership_type?: "profession" | "access_level"
          role_id?: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          deactivated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_memberships_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          resource: string
          action: string
          effect: "allow" | "deny"
          created_at: string
        }
        Insert: {
          id?: string
          role_id: string
          resource: string
          action: string
          effect?: "allow" | "deny"
          created_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          resource?: string
          action?: string
          effect?: "allow" | "deny"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_audit_log: {
        Row: {
          id: string
          user_id: string
          from_department_id: string | null
          to_department_id: string | null
          membership_type: "profession" | "access_level" | null
          role_id: string | null
          action: string
          reason: string | null
          performed_by: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_department_id?: string | null
          to_department_id?: string | null
          membership_type?: "profession" | "access_level" | null
          role_id?: string | null
          action: string
          reason?: string | null
          performed_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          from_department_id?: string | null
          to_department_id?: string | null
          membership_type?: "profession" | "access_level" | null
          role_id?: string | null
          action?: string
          reason?: string | null
          performed_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_questions: {
        Row: {
          id: string
          role_id: string
          department_id: string | null
          department_profession_id: string | null
          department_role: string | null
          question_label: string
          question_type: string
          question_description: string | null
          placeholder: string | null
          options: Json | null
          is_required: boolean
          display_order: number
          validation_rules: Json | null
          is_active: boolean
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
          min_value: number | null
          max_value: number | null
          min_length: number | null
          max_length: number | null
          pattern: string | null
          step: number | null
          min_date: string | null
          max_date: string | null
        }
        Insert: {
          id?: string
          role_id: string
          department_id?: string | null
          department_profession_id?: string | null
          department_role?: string | null
          question_label: string
          question_type: string
          question_description?: string | null
          placeholder?: string | null
          options?: Json | null
          is_required?: boolean
          display_order?: number
          validation_rules?: Json | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          min_value?: number | null
          max_value?: number | null
          min_length?: number | null
          max_length?: number | null
          pattern?: string | null
          step?: number | null
          min_date?: string | null
          max_date?: string | null
        }
        Update: {
          id?: string
          role_id?: string
          department_id?: string | null
          department_profession_id?: string | null
          department_role?: string | null
          question_label?: string
          question_type?: string
          question_description?: string | null
          placeholder?: string | null
          options?: Json | null
          is_required?: boolean
          display_order?: number
          validation_rules?: Json | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          min_value?: number | null
          max_value?: number | null
          min_length?: number | null
          max_length?: number | null
          pattern?: string | null
          step?: number | null
          min_date?: string | null
          max_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_questions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_questions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_questions_department_profession_id_fkey"
            columns: ["department_profession_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agents: {
        Row: {
          id: string
          department_id: string
          sales_promoter_user_id: string
          name: string
          location: string | null
          phone_e164: string | null
          phone_raw: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          department_id: string
          sales_promoter_user_id: string
          name: string
          location?: string | null
          phone_e164?: string | null
          phone_raw?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          department_id?: string
          sales_promoter_user_id?: string
          name?: string
          location?: string | null
          phone_e164?: string | null
          phone_raw?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_agents_sales_promoter_user_id_fkey"
            columns: ["sales_promoter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          department_id: string | null
          role_id: string
          is_active: boolean
          created_at: string
          updated_at: string
          metadata: Json | null
          last_login: string | null
          phone_e164: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          department_id?: string | null
          role_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          last_login?: string | null
          phone_e164?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          department_id?: string | null
          role_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          last_login?: string | null
          phone_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
      [_ in never]: never
    }
    Functions: {
      get_users_with_emails: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string
          created_at: string
          name: string
          department_id: string | null
          role_id: string
          role_name: string | null
          is_active: boolean
          profile_created_at: string
          last_login: string | null
        }[]
      }
    }
    Enums: {
      membership_type_enum: "profession" | "access_level"
      role_type_enum: "profession" | "access_level"
      role_scope_enum: "department" | "system"
    }
  }
}
