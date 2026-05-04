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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_duration_minutes: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_duration_minutes?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_duration_minutes?: number
          window_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          changes: Json | null
          entity_id: string
          id: string
          ip_address: unknown
          metadata: Json | null
          operation: string
          session_id: string | null
          severity: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          changes?: Json | null
          entity_id: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation: string
          session_id?: string | null
          severity?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          changes?: Json | null
          entity_id?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation?: string
          session_id?: string | null
          severity?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_log_entries: {
        Row: {
          created_at: string | null
          date: string
          department_id: string | null
          entry_kind: string
          entry_kind_version_id: string | null
          id: string
          metadata: Json | null
          question_set_version_id: string | null
          report_kind: string
          search_vector: unknown
          subject_agent_id: string | null
          subject_agent_snapshot: Json | null
          subject_department_id: string | null
          subject_profession_id: string | null
          submitted_by_user_id: string | null
          submitted_for_date: string | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          department_id?: string | null
          entry_kind?: string
          entry_kind_version_id?: string | null
          id?: string
          metadata?: Json | null
          question_set_version_id?: string | null
          report_kind?: string
          search_vector?: unknown
          subject_agent_id?: string | null
          subject_agent_snapshot?: Json | null
          subject_department_id?: string | null
          subject_profession_id?: string | null
          submitted_by_user_id?: string | null
          submitted_for_date?: string | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          department_id?: string | null
          entry_kind?: string
          entry_kind_version_id?: string | null
          id?: string
          metadata?: Json | null
          question_set_version_id?: string | null
          report_kind?: string
          search_vector?: unknown
          subject_agent_id?: string | null
          subject_agent_snapshot?: Json | null
          subject_department_id?: string | null
          subject_profession_id?: string | null
          submitted_by_user_id?: string | null
          submitted_for_date?: string | null
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
          {
            foreignKeyName: "captain_log_entries_entry_kind_version_id_fkey"
            columns: ["entry_kind_version_id"]
            isOneToOne: false
            referencedRelation: "entry_kind_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_log_entries_question_set_version_id_fkey"
            columns: ["question_set_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
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
            foreignKeyName: "captain_log_entries_user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "captain_log_entries_user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
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
          search_vector: unknown
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
          search_vector?: unknown
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
          search_vector?: unknown
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
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          level: number
          metadata: Json | null
          name: string
          parent_id: string | null
          path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          metadata?: Json | null
          name: string
          parent_id?: string | null
          path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          metadata?: Json | null
          name?: string
          parent_id?: string | null
          path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_drafts: {
        Row: {
          created_at: string
          current_step: number
          department_id: string | null
          entry_date: string
          expires_at: string
          id: string
          is_complete: boolean
          responses: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          department_id?: string | null
          entry_date: string
          expires_at?: string
          id?: string
          is_complete?: boolean
          responses?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          department_id?: string | null
          entry_date?: string
          expires_at?: string
          id?: string
          is_complete?: boolean
          responses?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_drafts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_kind_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          render_schema_version: number
          scope_entry_kind_id: string
          ui_schema: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          render_schema_version?: number
          scope_entry_kind_id: string
          ui_schema: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          render_schema_version?: number
          scope_entry_kind_id?: string
          ui_schema?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_kind_versions_scope_entry_kind_id_fkey"
            columns: ["scope_entry_kind_id"]
            isOneToOne: false
            referencedRelation: "scope_entry_kinds"
            referencedColumns: ["id"]
          },
        ]
      }
      export_history: {
        Row: {
          completed_at: string | null
          created_at: string
          department_id: string | null
          download_count: number
          downloaded_at: string | null
          error_message: string | null
          expires_at: string | null
          export_type: string
          file_size_bytes: number | null
          file_url: string | null
          format: string
          id: string
          parameters: Json | null
          record_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          download_count?: number
          downloaded_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type: string
          file_size_bytes?: number | null
          file_url?: string | null
          format: string
          id?: string
          parameters?: Json | null
          record_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          download_count?: number
          downloaded_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string
          id?: string
          parameters?: Json | null
          record_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          allowed_roles: string[] | null
          allowed_user_ids: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          name: string
          rollout_percentage: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_roles?: string[] | null
          allowed_user_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          name: string
          rollout_percentage?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_roles?: string[] | null
          allowed_user_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          name?: string
          rollout_percentage?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      file_attachments: {
        Row: {
          created_at: string
          draft_id: string | null
          entry_id: string | null
          file_size: number
          filename: string
          id: string
          mime_type: string
          question_id: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          entry_id?: string | null
          file_size: number
          filename: string
          id?: string
          mime_type: string
          question_id?: string | null
          storage_bucket: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          entry_id?: string | null
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          question_id?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_attachments_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "entry_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "captain_log_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "role_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      global_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          reason: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          reason?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          reason?: string | null
          year?: number | null
        }
        Relationships: []
      }
      marketing_agents: {
        Row: {
          area_name: string | null
          coverage_type: string | null
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          location: string | null
          metadata: Json
          name: string
          phone_e164: string | null
          phone_raw: string | null
          plate_number: string | null
          region_id: string | null
          sales_promoter_user_id: string
          sub_area: string | null
          updated_at: string
        }
        Insert: {
          area_name?: string | null
          coverage_type?: string | null
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          location?: string | null
          metadata?: Json
          name: string
          phone_e164?: string | null
          phone_raw?: string | null
          plate_number?: string | null
          region_id?: string | null
          sales_promoter_user_id: string
          sub_area?: string | null
          updated_at?: string
        }
        Update: {
          area_name?: string | null
          coverage_type?: string | null
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          location?: string | null
          metadata?: Json
          name?: string
          phone_e164?: string | null
          phone_raw?: string | null
          plate_number?: string | null
          region_id?: string | null
          sales_promoter_user_id?: string
          sub_area?: string | null
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
            foreignKeyName: "marketing_agents_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_audit_log: {
        Row: {
          action: string
          created_at: string
          from_department_id: string | null
          id: string
          membership_type:
            | Database["public"]["Enums"]["membership_type_enum"]
            | null
          metadata: Json | null
          performed_by: string | null
          reason: string | null
          role_id: string | null
          to_department_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          from_department_id?: string | null
          id?: string
          membership_type?:
            | Database["public"]["Enums"]["membership_type_enum"]
            | null
          metadata?: Json | null
          performed_by?: string | null
          reason?: string | null
          role_id?: string | null
          to_department_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          from_department_id?: string | null
          id?: string
          membership_type?:
            | Database["public"]["Enums"]["membership_type_enum"]
            | null
          metadata?: Json | null
          performed_by?: string | null
          reason?: string | null
          role_id?: string | null
          to_department_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_audit_log_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_audit_log_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_audit_log_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channels: Json
          created_at: string
          id: string
          is_enabled: boolean
          notification_type_id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channels: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_type_id: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_type_id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          category: string
          created_at: string
          default_channels: Json
          default_enabled: boolean
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          default_channels?: Json
          default_enabled?: boolean
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          default_channels?: Json
          default_enabled?: boolean
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          body: string
          channel_failures: Json | null
          channels_delivered: Json | null
          created_at: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean
          metadata: Json | null
          notification_type_id: string
          read_at: string | null
          scheduled_for: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          body: string
          channel_failures?: Json | null
          channels_delivered?: Json | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type_id: string
          read_at?: string | null
          scheduled_for?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          body?: string
          channel_failures?: Json | null
          channels_delivered?: Json | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type_id?: string
          read_at?: string | null
          scheduled_for?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          action: string
          assignable_to_department_levels: boolean | null
          assignable_to_global_roles: boolean | null
          created_at: string
          description: string | null
          id: string
          requires_department: boolean | null
          resource: string
          scope: string
          updated_at: string
        }
        Insert: {
          action: string
          assignable_to_department_levels?: boolean | null
          assignable_to_global_roles?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          requires_department?: boolean | null
          resource: string
          scope?: string
          updated_at?: string
        }
        Update: {
          action?: string
          assignable_to_department_levels?: boolean | null
          assignable_to_global_roles?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          requires_department?: boolean | null
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
      question_set_versions: {
        Row: {
          created_at: string
          created_by: string | null
          entry_kind_version_id: string
          id: string
          questions: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_kind_version_id: string
          id?: string
          questions: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_kind_version_id?: string
          id?: string
          questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "question_set_versions_entry_kind_version_id_fkey"
            columns: ["entry_kind_version_id"]
            isOneToOne: false
            referencedRelation: "entry_kind_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      report_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          report_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          report_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "report_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_answers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_questions: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          question_category: string | null
          question_key: string
          question_label: string
          question_type: string
          role_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          question_category?: string | null
          question_key: string
          question_label: string
          question_type: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          question_category?: string | null
          question_key?: string
          question_label?: string
          question_type?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_questions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_exceptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          reason: string | null
          target_date: string
          user_department_role_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          reason?: string | null
          target_date: string
          user_department_role_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string | null
          target_date?: string
          user_department_role_id?: string | null
        }
        Relationships: []
      }
      reporting_policies: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          deadline_day_offset: number | null
          deadline_time: string | null
          department_id: string | null
          frequency_type: string | null
          id: string
          is_active: boolean | null
          reporting_cycle: string | null
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          deadline_day_offset?: number | null
          deadline_time?: string | null
          department_id?: string | null
          frequency_type?: string | null
          id?: string
          is_active?: boolean | null
          reporting_cycle?: string | null
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          deadline_day_offset?: number | null
          deadline_time?: string | null
          department_id?: string | null
          frequency_type?: string | null
          id?: string
          is_active?: boolean | null
          reporting_cycle?: string | null
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporting_policies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: string
          created_at: string
          effect: string
          id: string
          resource: string
          role_id: string
        }
        Insert: {
          action: string
          created_at?: string
          effect?: string
          id?: string
          resource: string
          role_id: string
        }
        Update: {
          action?: string
          created_at?: string
          effect?: string
          id?: string
          resource?: string
          role_id?: string
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
      role_questions: {
        Row: {
          conditional_logic: Json | null
          created_at: string
          created_by: string | null
          default_value: string | null
          department_id: string | null
          department_profession_id: string | null
          department_role: string | null
          display_order: number
          entry_kind: string
          help_text: string | null
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
          question_scope_type: Database["public"]["Enums"]["question_scope_type_enum"]
          question_type: string
          step: number | null
          updated_at: string
          updated_by: string | null
          validation_rules: Json | null
        }
        Insert: {
          conditional_logic?: Json | null
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          department_id?: string | null
          department_profession_id?: string | null
          department_role?: string | null
          display_order?: number
          entry_kind?: string
          help_text?: string | null
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
          question_scope_type: Database["public"]["Enums"]["question_scope_type_enum"]
          question_type: string
          step?: number | null
          updated_at?: string
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Update: {
          conditional_logic?: Json | null
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          department_id?: string | null
          department_profession_id?: string | null
          department_role?: string | null
          display_order?: number
          entry_kind?: string
          help_text?: string | null
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
          question_scope_type?: Database["public"]["Enums"]["question_scope_type_enum"]
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
          {
            foreignKeyName: "role_questions_department_profession_id_fkey"
            columns: ["department_profession_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          level: number
          name: string
          scope: Database["public"]["Enums"]["role_scope_enum"]
          sort_order: number | null
          type: Database["public"]["Enums"]["role_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          level?: number
          name: string
          scope?: Database["public"]["Enums"]["role_scope_enum"]
          sort_order?: number | null
          type?: Database["public"]["Enums"]["role_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          level?: number
          name?: string
          scope?: Database["public"]["Enums"]["role_scope_enum"]
          sort_order?: number | null
          type?: Database["public"]["Enums"]["role_type_enum"]
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
      scheduled_job_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          error_message: string | null
          id: string
          job_id: string
          output: string | null
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          output?: string | null
          started_at?: string
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          output?: string | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fail_count: number
          id: string
          is_active: boolean
          job_type: string
          last_run_at: string | null
          last_run_error: string | null
          last_run_status: string | null
          name: string
          next_run_at: string | null
          parameters: Json | null
          run_count: number
          schedule_cron: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fail_count?: number
          id?: string
          is_active?: boolean
          job_type: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          name: string
          next_run_at?: string | null
          parameters?: Json | null
          run_count?: number
          schedule_cron: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fail_count?: number
          id?: string
          is_active?: boolean
          job_type?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          name?: string
          next_run_at?: string | null
          parameters?: Json | null
          run_count?: number
          schedule_cron?: string
          updated_at?: string
        }
        Relationships: []
      }
      scope_entry_kinds: {
        Row: {
          allow_multiple_per_day: boolean
          allowed_weekdays: number[] | null
          available_end_date: string | null
          available_start_date: string | null
          color: string | null
          created_at: string
          created_by: string | null
          department_id: string
          department_profession_id: string | null
          description: string | null
          entry_kind: string
          has_department_sections: boolean | null
          has_profession_sections: boolean | null
          icon: string | null
          id: string
          is_active: boolean
          is_available: boolean
          is_default: boolean
          label: string
          profession_role_id: string | null
          scope_type: Database["public"]["Enums"]["entry_kind_scope_type_enum"]
          sort_order: number
          status: string | null
          supports_assigned_agent: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_multiple_per_day?: boolean
          allowed_weekdays?: number[] | null
          available_end_date?: string | null
          available_start_date?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          department_profession_id?: string | null
          description?: string | null
          entry_kind: string
          has_department_sections?: boolean | null
          has_profession_sections?: boolean | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_default?: boolean
          label: string
          profession_role_id?: string | null
          scope_type?: Database["public"]["Enums"]["entry_kind_scope_type_enum"]
          sort_order?: number
          status?: string | null
          supports_assigned_agent?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_multiple_per_day?: boolean
          allowed_weekdays?: number[] | null
          available_end_date?: string | null
          available_start_date?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          department_profession_id?: string | null
          description?: string | null
          entry_kind?: string
          has_department_sections?: boolean | null
          has_profession_sections?: boolean | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_default?: boolean
          label?: string
          profession_role_id?: string | null
          scope_type?: Database["public"]["Enums"]["entry_kind_scope_type_enum"]
          sort_order?: number
          status?: string | null
          supports_assigned_agent?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scope_entry_kinds_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_entry_kinds_profession_role_id_fkey"
            columns: ["profession_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_team_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          department_id: string | null
          expires_at: string | null
          id: string
          is_published: boolean
          sub_team_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean
          sub_team_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean
          sub_team_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_team_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_team_announcements_sub_team_id_fkey"
            columns: ["sub_team_id"]
            isOneToOne: false
            referencedRelation: "sub_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_team_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          role: string
          sub_team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          role?: string
          sub_team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          role?: string
          sub_team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_team_members_sub_team_id_fkey"
            columns: ["sub_team_id"]
            isOneToOne: false
            referencedRelation: "sub_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_teams: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_editable: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_editable?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_editable?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      trash_bin: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          expires_at: string
          id: string
          is_permanent: boolean
          original_data: Json
          original_id: string
          original_table: string
          restored_at: string | null
          restored_by: string | null
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          is_permanent?: boolean
          original_data: Json
          original_id: string
          original_table: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          is_permanent?: boolean
          original_data?: Json
          original_id?: string
          original_table?: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Relationships: []
      }
      user_department_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          department_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_used_at: string | null
          membership_type: Database["public"]["Enums"]["membership_type_enum"]
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          department_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          membership_type: Database["public"]["Enums"]["membership_type_enum"]
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          department_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          membership_type?: Database["public"]["Enums"]["membership_type_enum"]
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
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
      user_department_profession_events_archive: {
        Row: {
          action: string
          archived_at: string | null
          deleted_snapshot: Json | null
          department_id: string
          id: string
          ip_address: unknown
          membership_id: string | null
          new_is_active: boolean | null
          new_is_primary: boolean | null
          new_role: string | null
          performed_at: string
          performed_by: string | null
          previous_is_active: boolean | null
          previous_is_primary: boolean | null
          previous_role: string | null
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          archived_at?: string | null
          deleted_snapshot?: Json | null
          department_id: string
          id?: string
          ip_address?: unknown
          membership_id?: string | null
          new_is_active?: boolean | null
          new_is_primary?: boolean | null
          new_role?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_is_active?: boolean | null
          previous_is_primary?: boolean | null
          previous_role?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          archived_at?: string | null
          deleted_snapshot?: Json | null
          department_id?: string
          id?: string
          ip_address?: unknown
          membership_id?: string | null
          new_is_active?: boolean | null
          new_is_primary?: boolean | null
          new_role?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_is_active?: boolean | null
          previous_is_primary?: boolean | null
          previous_role?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          browser_version: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          fingerprint: string | null
          id: string
          ip_address: unknown
          is_revoked: boolean
          is_trusted: boolean
          last_used_at: string
          os: string | null
          os_version: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_revoked?: boolean
          is_trusted?: boolean
          last_used_at?: string
          os?: string | null
          os_version?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_revoked?: boolean
          is_trusted?: boolean
          last_used_at?: string
          os?: string | null
          os_version?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          phone_e164: string | null
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
          phone_e164?: string | null
          role_id?: string
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
          phone_e164?: string | null
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
      user_sessions: {
        Row: {
          device_id: string | null
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          is_active: boolean
          last_active_at: string
          metadata: Json | null
          started_at: string
          supabase_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          device_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_active_at?: string
          metadata?: Json | null
          started_at?: string
          supabase_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          device_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_active_at?: string
          metadata?: Json | null
          started_at?: string
          supabase_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          dashboard_layout: Json | null
          id: string
          language: string
          notification_email: boolean
          notification_push: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_layout?: Json | null
          id?: string
          language?: string
          notification_email?: boolean
          notification_push?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_layout?: Json | null
          id?: string
          language?: string
          notification_email?: boolean
          notification_push?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_status_periods: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          reason: string | null
          start_date: string
          status_type: string
          updated_at: string
          user_department_role_id: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          reason?: string | null
          start_date: string
          status_type: string
          updated_at?: string
          user_department_role_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          reason?: string | null
          start_date?: string
          status_type?: string
          updated_at?: string
          user_department_role_id?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt_number: number
          attempted_at: string
          error_message: string | null
          event_type: string
          id: string
          is_success: boolean
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          signature: string
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          attempt_number?: number
          attempted_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          is_success?: boolean
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          signature: string
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          is_success?: boolean
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          signature?: string
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_status_code: number | null
          last_triggered_at: string | null
          name: string
          retry_count: number
          secret: string
          success_count: number
          timeout_ms: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          events: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          name: string
          retry_count?: number
          secret: string
          success_count?: number
          timeout_ms?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          name?: string
          retry_count?: number
          secret?: string
          success_count?: number
          timeout_ms?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      archive_old_membership_events: {
        Args: { p_days?: number }
        Returns: number
      }
      calculate_next_run: { Args: { p_cron: string }; Returns: string }
      can_manage_sub_team_members: {
        Args: { p_sub_team_id: string; p_user_id: string }
        Returns: boolean
      }
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
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_old_sessions: {
        Args: { p_max_age_hours?: number }
        Returns: number
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_body: string
          p_metadata?: Json
          p_notification_key: string
          p_scheduled_for?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
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
      end_user_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: undefined
      }
      generate_webhook_signature: {
        Args: { p_payload: Json; p_secret: string }
        Returns: string
      }
      get_active_sessions: {
        Args: never
        Returns: {
          browser: string
          device_name: string
          device_type: string
          ip_address: unknown
          is_trusted: boolean
          last_active_at: string
          os: string
          session_id: string
          started_at: string
        }[]
      }
      get_config: { Args: { p_key: string }; Returns: Json }
      get_current_user_role: {
        Args: never
        Returns: {
          is_active: boolean
          name: string
          role_id: string
          user_id: string
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
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
      has_department_access: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      has_department_membership: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      has_department_role: {
        Args: { p_department_id: string; p_roles: string[] }
        Returns: boolean
      }
      has_permission_in_department: {
        Args: {
          p_action: string
          p_department_id: string
          p_resource: string
          p_user_id: string
        }
        Returns: boolean
      }
      initialize_user_notification_preferences: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      is_admin_or_super_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_admin_user: { Args: { p_user_id: string }; Returns: boolean }
      is_admin_v2: { Args: never; Returns: boolean }
      is_entry_kind_available: {
        Args: {
          p_allowed_weekdays: number[]
          p_end_date: string
          p_is_active: boolean
          p_is_available: boolean
          p_report_date: string
          p_start_date: string
        }
        Returns: boolean
      }
      is_feature_enabled: { Args: { p_feature_key: string }; Returns: boolean }
      log_scheduled_job_run: {
        Args: {
          p_error_message?: string
          p_job_id: string
          p_output?: string
          p_status: string
        }
        Returns: undefined
      }
      mark_export_downloaded: {
        Args: { p_export_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      move_member_atomic:
        | {
            Args: {
              p_from_department_id: string
              p_is_primary: boolean
              p_membership_type: Database["public"]["Enums"]["membership_type_enum"]
              p_performed_by: string
              p_reason?: string
              p_role_id: string
              p_to_department_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_from_department_id: string
              p_new_role: string
              p_performed_by: string
              p_reason?: string
              p_to_department_id: string
              p_user_id: string
            }
            Returns: Json
          }
      record_user_device: {
        Args: {
          p_fingerprint?: string
          p_ip_address: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: string
      }
      record_webhook_delivery: {
        Args: {
          p_attempt_number?: number
          p_error_message?: string
          p_event_type: string
          p_payload: Json
          p_response_body?: string
          p_signature: string
          p_status_code?: number
          p_webhook_id: string
        }
        Returns: undefined
      }
      refresh_session_expiration: {
        Args: { p_interval?: string; p_session_id: string }
        Returns: string
      }
      repair_missing_primary: { Args: never; Returns: number }
      revoke_all_user_sessions: {
        Args: { p_except_session_id?: string; p_user_id: string }
        Returns: number
      }
      revoke_user_device: { Args: { p_device_id: string }; Returns: undefined }
      search_entries: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_department_id?: string
          p_limit?: number
          p_query: string
          p_user_id?: string
        }
        Returns: {
          department_id: string
          entry_date: string
          entry_id: string
          mood: string
          rank: number
          snippet: string
          status: string
          user_id: string
        }[]
      }
      search_logs: {
        Args: {
          p_can_view_department_logs?: boolean
          p_cursor_date?: string
          p_cursor_id?: string
          p_date?: string
          p_department_id?: string
          p_limit?: number
          p_search_name?: string
          p_similarity_threshold?: number
          p_user_id: string
        }
        Returns: {
          created_at: string
          date: string
          department_name: string
          entry_kind: string
          id: string
          response_count: number
          subject_agent_snapshot: Json
          subject_department_id: string
          updated_at: string
          user_id: string
          user_name: string
        }[]
      }
      search_responses: {
        Args: { p_entry_id?: string; p_limit?: number; p_query: string }
        Returns: {
          entry_id: string
          question_id: string
          rank: number
          response_id: string
          response_text: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_to_trash: {
        Args: {
          p_deleted_by?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      start_user_session: {
        Args: {
          p_fingerprint?: string
          p_ip_address: string
          p_supabase_session_id?: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: string
      }
      test_user_role: {
        Args: never
        Returns: {
          is_active: boolean
          role_id: string
          user_id: string
        }[]
      }
      update_membership_with_primary: {
        Args: {
          p_department_id: string
          p_performed_by: string
          p_reason?: string
          p_updates: Json
          p_user_id: string
        }
        Returns: Json
      }
      update_scope_entry_kinds_bulk: {
        Args: {
          p_configs: Json
          p_department_id: string
          p_profession_role_id: string
          p_scope_type: Database["public"]["Enums"]["entry_kind_scope_type_enum"]
          p_updated_by: string
        }
        Returns: {
          allow_multiple_per_day: boolean
          allowed_weekdays: number[] | null
          available_end_date: string | null
          available_start_date: string | null
          color: string | null
          created_at: string
          created_by: string | null
          department_id: string
          department_profession_id: string | null
          description: string | null
          entry_kind: string
          has_department_sections: boolean | null
          has_profession_sections: boolean | null
          icon: string | null
          id: string
          is_active: boolean
          is_available: boolean
          is_default: boolean
          label: string
          profession_role_id: string | null
          scope_type: Database["public"]["Enums"]["entry_kind_scope_type_enum"]
          sort_order: number
          status: string | null
          supports_assigned_agent: boolean
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "scope_entry_kinds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_session_activity: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      user_has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      validate_primary_existence: {
        Args: never
        Returns: {
          active_count: number
          primary_count: number
          user_id: string
        }[]
      }
    }
    Enums: {
      entry_kind_scope_type_enum:
        | "dept_wide_personal"
        | "profession_personal"
        | "dept_report"
      membership_type_enum: "profession" | "access_level"
      question_scope_type_enum:
        | "dept_wide_personal"
        | "profession_personal"
        | "dept_report"
      role_scope_enum: "department" | "system"
      role_type_enum: "profession" | "access_level"
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
    Enums: {
      entry_kind_scope_type_enum: [
        "dept_wide_personal",
        "profession_personal",
        "dept_report",
      ],
      membership_type_enum: ["profession", "access_level"],
      question_scope_type_enum: [
        "dept_wide_personal",
        "profession_personal",
        "dept_report",
      ],
      role_scope_enum: ["department", "system"],
      role_type_enum: ["profession", "access_level"],
    },
  },
} as const
