export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      captain_log_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          objectives: string | null
          key_results: string | null
          challenges: string | null
          development_tasks: string | null
          features_completed: string | null
          challenges_and_blockers: string | null
          code_and_priorities: string | null
          system_improvements: string | null
          project_updates: string | null
          created_at: string
          updated_at: string
          version: number
          metadata: Json | null
        }
        Insert: {
          id: string
          user_id: string
          date: string
          objectives?: string | null
          key_results?: string | null
          challenges?: string | null
          development_tasks?: string | null
          features_completed?: string | null
          challenges_and_blockers?: string | null
          code_and_priorities?: string | null
          system_improvements?: string | null
          project_updates?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          objectives?: string | null
          key_results?: string | null
          challenges?: string | null
          development_tasks?: string | null
          features_completed?: string | null
          challenges_and_blockers?: string | null
          code_and_priorities?: string | null
          system_improvements?: string | null
          project_updates?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          metadata?: Json | null
        }
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
          id: string
          entry_id: string
          question_id: string
          question_key: string
          question_label?: string | null
          question_type?: string | null
          question_category?: string | null
          value: Json
          timestamp: string
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
          id: string
          timestamp: string
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
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          role_id: string
          resource: string
          action: string
          conditions: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role_id: string
          resource: string
          action: string
          conditions?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          resource?: string
          action?: string
          conditions?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          department: string | null
          role_id: string
          is_active: boolean
          created_at: string
          updated_at: string
          metadata: Json | null
          last_login: string | null
        }
        Insert: {
          id: string
          user_id: string
          name: string
          department?: string | null
          role_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          last_login?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          department?: string | null
          role_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          last_login?: string | null
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          code: string | null
          description: string | null
          is_active: boolean
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
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
          department: string | null
          role_id: string
          role_name: string | null
          is_active: boolean
          profile_created_at: string
          last_login: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
