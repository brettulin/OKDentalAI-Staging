export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          booking_policy: Json | null
          clinic_id: string
          created_at: string
          id: string
          language: string | null
          transfer_number: string | null
          updated_at: string
          voice_id: string | null
          voice_model: string | null
          voice_provider: string | null
        }
        Insert: {
          booking_policy?: Json | null
          clinic_id: string
          created_at?: string
          id?: string
          language?: string | null
          transfer_number?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_model?: string | null
          voice_provider?: string | null
        }
        Update: {
          booking_policy?: Json | null
          clinic_id?: string
          created_at?: string
          id?: string
          language?: string | null
          transfer_number?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_model?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          clinic_id: string
          created_at: string
          ends_at: string
          external_id: string | null
          id: string
          location_id: string | null
          office_id: string | null
          patient_id: string
          provider_id: string | null
          service_id: string
          source: string | null
          starts_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          ends_at: string
          external_id?: string | null
          id?: string
          location_id?: string | null
          office_id?: string | null
          patient_id: string
          provider_id?: string | null
          service_id: string
          source?: string | null
          starts_at: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          ends_at?: string
          external_id?: string | null
          id?: string
          location_id?: string | null
          office_id?: string | null
          patient_id?: string
          provider_id?: string | null
          service_id?: string
          source?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "office_pms_status"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "appointments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          at: string
          clinic_id: string
          diff_json: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor: string
          at?: string
          clinic_id: string
          diff_json?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          clinic_id?: string
          diff_json?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          call_id: string
          created_at: string
          created_by: string | null
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          created_by?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          created_by?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          ai_confidence_score: number | null
          assigned_to: string | null
          call_duration_seconds: number | null
          caller_phone: string | null
          clinic_id: string
          ended_at: string | null
          id: string
          office_id: string | null
          outcome: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status_type"] | null
          transcript_json: Json | null
          twilio_call_sid: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          assigned_to?: string | null
          call_duration_seconds?: number | null
          caller_phone?: string | null
          clinic_id: string
          ended_at?: string | null
          id?: string
          office_id?: string | null
          outcome?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status_type"] | null
          transcript_json?: Json | null
          twilio_call_sid?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          assigned_to?: string | null
          call_duration_seconds?: number | null
          caller_phone?: string | null
          clinic_id?: string
          ended_at?: string | null
          id?: string
          office_id?: string | null
          outcome?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status_type"] | null
          transcript_json?: Json | null
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "office_pms_status"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "calls_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_hours: {
        Row: {
          clinic_id: string
          close_min: number
          created_at: string
          dow: number
          id: string
          open_min: number
        }
        Insert: {
          clinic_id: string
          close_min: number
          created_at?: string
          dow: number
          id?: string
          open_min: number
        }
        Update: {
          clinic_id?: string
          close_min?: number
          created_at?: string
          dow?: number
          id?: string
          open_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_hours_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          id: string
          main_phone: string | null
          name: string
          timezone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          main_phone?: string | null
          name: string
          timezone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          main_phone?: string | null
          name?: string
          timezone?: string | null
        }
        Relationships: []
      }
      insurances: {
        Row: {
          accepted: boolean | null
          clinic_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          accepted?: boolean | null
          clinic_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          accepted?: boolean | null
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurances_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          clinic_id: string
          created_at: string
          encrypted_credentials: string | null
          id: string
          name: string
          pms_credentials: Json | null
          pms_type: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          encrypted_credentials?: string | null
          id?: string
          name: string
          pms_credentials?: Json | null
          pms_type: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          encrypted_credentials?: string | null
          id?: string
          name?: string
          pms_credentials?: Json | null
          pms_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          clinic_id: string
          created_at: string
          dob: string | null
          email: string | null
          external_id: string | null
          full_name: string
          id: string
          notes: string | null
          office_id: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          dob?: string | null
          email?: string | null
          external_id?: string | null
          full_name: string
          id?: string
          notes?: string | null
          office_id?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          dob?: string | null
          email?: string | null
          external_id?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          office_id?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "office_pms_status"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "patients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role_type"] | null
          clinic_id: string | null
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role_type"] | null
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role_type"] | null
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          name: string
          specialty: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          specialty?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          count: number
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_type: string
          count?: number
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_type?: string
          count?: number
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          clinic_id: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          clinic_id: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          clinic_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action_type: string
          clinic_id: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          risk_level: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          clinic_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          risk_level?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          risk_level?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          clinic_id: string
          code: string | null
          created_at: string
          duration_min: number
          id: string
          is_new_patient: boolean | null
          name: string
        }
        Insert: {
          clinic_id: string
          code?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          is_new_patient?: boolean | null
          name: string
        }
        Update: {
          clinic_id?: string
          code?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          is_new_patient?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          clinic_id: string
          created_at: string
          ends_at: string
          held_until: string | null
          id: string
          location_id: string | null
          provider_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          ends_at: string
          held_until?: string | null
          id?: string
          location_id?: string | null
          provider_id?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          ends_at?: string
          held_until?: string | null
          id?: string
          location_id?: string | null
          provider_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          at: string
          call_id: string
          id: string
          meta: Json | null
          role: string
          text: string
        }
        Insert: {
          at?: string
          call_id: string
          id?: string
          meta?: Json | null
          role: string
          text: string
        }
        Update: {
          at?: string
          call_id?: string
          id?: string
          meta?: Json | null
          role?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      office_pms_status: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          has_credentials: boolean | null
          name: string | null
          office_id: string | null
          pms_type: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          has_credentials?: never
          name?: string | null
          office_id?: string | null
          pms_type?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          has_credentials?: never
          name?: string | null
          office_id?: string | null
          pms_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_security_metrics: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_limit?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_sensitive_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clear_expired_holds: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_security_alert: {
        Args: {
          p_clinic_id: string
          p_alert_type: string
          p_severity: string
          p_description: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      emergency_revoke_access: {
        Args: { p_user_id: string; p_reason: string }
        Returns: undefined
      }
      encrypt_sensitive_field: {
        Args: { p_value: string; p_context?: string }
        Returns: string
      }
      get_allowed_call_outcomes: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_assigned_patient_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      has_admin_permission: {
        Args: { permission_type: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_resource_type: string
          p_resource_id?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      log_sensitive_access: {
        Args: {
          p_clinic_id: string
          p_action_type: string
          p_resource_type: string
          p_resource_id?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      update_admin_role: {
        Args: {
          target_user_id: string
          new_admin_role: Database["public"]["Enums"]["admin_role_type"]
        }
        Returns: undefined
      }
      update_user_role: {
        Args: { target_user_id: string; new_role: string }
        Returns: undefined
      }
      user_can_access_patient: {
        Args: { patient_id: string }
        Returns: boolean
      }
      validate_call_transcript_access: {
        Args: { p_call_id: string; p_operation: string }
        Returns: boolean
      }
      validate_comprehensive_access: {
        Args: {
          p_resource_type: string
          p_resource_id: string
          p_operation: string
        }
        Returns: boolean
      }
      validate_conversation_access: {
        Args: { p_call_id: string }
        Returns: boolean
      }
      validate_patient_access_with_logging: {
        Args: { p_patient_id: string; p_operation: string }
        Returns: boolean
      }
      validate_pms_credential_access: {
        Args: { p_office_id: string; p_purpose: string }
        Returns: boolean
      }
      validate_production_readiness: {
        Args: { p_clinic_id: string }
        Returns: {
          check_name: string
          status: string
          details: string
        }[]
      }
      validate_session_integrity: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      admin_role_type: "technical_admin" | "medical_admin" | "clinic_admin"
      call_status_type:
        | "incoming"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "failed"
        | "transferred"
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
      admin_role_type: ["technical_admin", "medical_admin", "clinic_admin"],
      call_status_type: [
        "incoming",
        "in_progress",
        "on_hold",
        "completed",
        "failed",
        "transferred",
      ],
    },
  },
} as const
