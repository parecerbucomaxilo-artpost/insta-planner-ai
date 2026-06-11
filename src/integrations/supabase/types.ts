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
      perfil_usuario: {
        Row: {
          arroba_usuario: string
          buffer_access_token: string | null
          created_at: string
          cro_uf: string
          id: string
          instagram_access_token: string | null
          instagram_arroba: string
          instagram_business_account_id: string | null
          instagram_foto_url: string | null
          linkedin_access_token: string | null
          linkedin_foto_url: string | null
          linkedin_nome: string
          linkedin_urn: string | null
          make_webhook_url: string | null
          nome_profissional: string
          subespecialidades: string[]
          tom_voz: string
          updated_at: string
          url_logo: string | null
          user_id: string | null
          webhook_url: string | null
        }
        Insert: {
          arroba_usuario?: string
          buffer_access_token?: string | null
          created_at?: string
          cro_uf?: string
          id?: string
          instagram_access_token?: string | null
          instagram_arroba?: string
          instagram_business_account_id?: string | null
          instagram_foto_url?: string | null
          linkedin_access_token?: string | null
          linkedin_foto_url?: string | null
          linkedin_nome?: string
          linkedin_urn?: string | null
          make_webhook_url?: string | null
          nome_profissional?: string
          subespecialidades?: string[]
          tom_voz?: string
          updated_at?: string
          url_logo?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          arroba_usuario?: string
          buffer_access_token?: string | null
          created_at?: string
          cro_uf?: string
          id?: string
          instagram_access_token?: string | null
          instagram_arroba?: string
          instagram_business_account_id?: string | null
          instagram_foto_url?: string | null
          linkedin_access_token?: string | null
          linkedin_foto_url?: string | null
          linkedin_nome?: string
          linkedin_urn?: string | null
          make_webhook_url?: string | null
          nome_profissional?: string
          subespecialidades?: string[]
          tom_voz?: string
          updated_at?: string
          url_logo?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          aviso_500_atingido: boolean
          created_at: string
          data_agendamento: string | null
          estilo_layout: string
          formato_midia: string
          id: string
          imagens_carrossel: Json
          legenda: string
          legenda_instagram: string | null
          legenda_linkedin: string | null
          postar_instagram: boolean
          postar_linkedin: boolean
          prompt_ia: string | null
          status: string
          tipo_post: string
          updated_at: string
          url_imagem: string | null
          user_id: string | null
          visualizacoes: number
        }
        Insert: {
          aviso_500_atingido?: boolean
          created_at?: string
          data_agendamento?: string | null
          estilo_layout?: string
          formato_midia?: string
          id?: string
          imagens_carrossel?: Json
          legenda?: string
          legenda_instagram?: string | null
          legenda_linkedin?: string | null
          postar_instagram?: boolean
          postar_linkedin?: boolean
          prompt_ia?: string | null
          status?: string
          tipo_post: string
          updated_at?: string
          url_imagem?: string | null
          user_id?: string | null
          visualizacoes?: number
        }
        Update: {
          aviso_500_atingido?: boolean
          created_at?: string
          data_agendamento?: string | null
          estilo_layout?: string
          formato_midia?: string
          id?: string
          imagens_carrossel?: Json
          legenda?: string
          legenda_instagram?: string | null
          legenda_linkedin?: string | null
          postar_instagram?: boolean
          postar_linkedin?: boolean
          prompt_ia?: string | null
          status?: string
          tipo_post?: string
          updated_at?: string
          url_imagem?: string | null
          user_id?: string | null
          visualizacoes?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
