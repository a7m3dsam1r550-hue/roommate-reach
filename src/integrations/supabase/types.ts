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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      broadcasts: {
        Row: {
          author_id: string
          hotel_id: string
          message: string
          updated_at: string
          work_date: string
        }
        Insert: {
          author_id?: string
          hotel_id: string
          message?: string
          updated_at?: string
          work_date?: string
        }
        Update: {
          author_id?: string
          hotel_id?: string
          message?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          code: string
          created_at: string
          id: string
          max_managers: number
          max_staff: number
          max_supervisors: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          max_managers?: number
          max_staff?: number
          max_supervisors?: number
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          max_managers?: number
          max_staff?: number
          max_supervisors?: number
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          assignment_id: string | null
          created_at: string
          hotel_id: string
          houseman_id: string | null
          id: string
          kind: string
          message: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          hotel_id: string
          houseman_id?: string | null
          id?: string
          kind: string
          message: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          hotel_id?: string
          houseman_id?: string | null
          id?: string
          kind?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      room_assignments: {
        Row: {
          created_at: string
          ended_at: string | null
          evening_guests: number | null
          hotel_id: string | null
          houseman_id: string
          id: string
          morning_guests: number | null
          room_number: string
          room_status: string | null
          started_at: string | null
          work_date: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          evening_guests?: number | null
          hotel_id?: string | null
          houseman_id: string
          id?: string
          morning_guests?: number | null
          room_number: string
          room_status?: string | null
          started_at?: string | null
          work_date?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          evening_guests?: number | null
          hotel_id?: string | null
          houseman_id?: string
          id?: string
          morning_guests?: number | null
          room_number?: string
          room_status?: string | null
          started_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_houseman_id_fkey"
            columns: ["houseman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_notes: {
        Row: {
          assignment_id: string
          author_id: string
          body: string
          created_at: string
          hotel_id: string
          id: string
          is_maintenance: boolean
          photos: string[]
        }
        Insert: {
          assignment_id: string
          author_id?: string
          body?: string
          created_at?: string
          hotel_id: string
          id?: string
          is_maintenance?: boolean
          photos?: string[]
        }
        Update: {
          assignment_id?: string
          author_id?: string
          body?: string
          created_at?: string
          hotel_id?: string
          id?: string
          is_maintenance?: boolean
          photos?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "room_notes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "room_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_notes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_sessions: {
        Row: {
          assignment_id: string
          created_at: string
          ended_at: string | null
          hotel_id: string
          houseman_id: string
          id: string
          note: string | null
          started_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          ended_at?: string | null
          hotel_id: string
          houseman_id: string
          id?: string
          note?: string | null
          started_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          ended_at?: string | null
          hotel_id?: string
          houseman_id?: string
          id?: string
          note?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "room_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      signoffs: {
        Row: {
          author_id: string
          created_at: string
          hotel_id: string
          id: string
          kind: string
          note: string
          report: Json | null
          signature: string
          work_date: string
        }
        Insert: {
          author_id?: string
          created_at?: string
          hotel_id: string
          id?: string
          kind: string
          note?: string
          report?: Json | null
          signature?: string
          work_date?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          hotel_id?: string
          id?: string
          kind?: string
          note?: string
          report?: Json | null
          signature?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "signoffs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          hotel_id: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          hotel_id: string
          staff_id: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          staff_id: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          staff_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_tasks: {
        Row: {
          body: string
          hotel_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          body?: string
          hotel_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          body?: string
          hotel_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      can_see_assignment: { Args: { _id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hotel_of: { Args: { _user: string }; Returns: string }
      is_my_team: { Args: { _staff: string }; Returns: boolean }
      list_hotels: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      my_hotel: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      room_check_in: { Args: { _id: string }; Returns: undefined }
      room_check_out: { Args: { _id: string }; Returns: undefined }
      room_check_out_note: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      super_admin_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "houseman"
      staff_role:
        | "super_admin"
        | "hotel_admin"
        | "manager"
        | "supervisor"
        | "houseman"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "houseman"],
      staff_role: [
        "super_admin",
        "hotel_admin",
        "manager",
        "supervisor",
        "houseman",
      ],
    },
  },
} as const
