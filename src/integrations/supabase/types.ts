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
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          payload: string
          stock_item_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          payload: string
          stock_item_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          payload?: string
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivered_at: string | null
          expected_amount: number | null
          expires_at: string | null
          id: string
          invoice_url: string | null
          last_checked_at: string | null
          order_code: string
          paid_at: string | null
          pay_address: string | null
          pay_amount: number | null
          pay_currency: string | null
          payment_id: string | null
          payment_provider: string
          payment_wallet_id: string | null
          product_id: string
          product_name: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          total_usd: number
          tx_hash: string | null
          unit_price_usd: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          expected_amount?: number | null
          expires_at?: string | null
          id?: string
          invoice_url?: string | null
          last_checked_at?: string | null
          order_code?: string
          paid_at?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_provider?: string
          payment_wallet_id?: string | null
          product_id: string
          product_name: string
          quantity: number
          status?: Database["public"]["Enums"]["order_status"]
          total_usd: number
          tx_hash?: string | null
          unit_price_usd: number
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          expected_amount?: number | null
          expires_at?: string | null
          id?: string
          invoice_url?: string | null
          last_checked_at?: string | null
          order_code?: string
          paid_at?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_provider?: string
          payment_wallet_id?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_usd?: number
          tx_hash?: string | null
          unit_price_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_wallet_id_fkey"
            columns: ["payment_wallet_id"]
            isOneToOne: false
            referencedRelation: "payment_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_counts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_wallets: {
        Row: {
          address: string
          asset: string
          chain: string
          contract_address: string | null
          created_at: string
          decimals: number
          id: string
          is_active: boolean
          label: string
          min_confirmations: number
          sort_order: number
        }
        Insert: {
          address: string
          asset: string
          chain: string
          contract_address?: string | null
          created_at?: string
          decimals?: number
          id?: string
          is_active?: boolean
          label: string
          min_confirmations?: number
          sort_order?: number
        }
        Update: {
          address?: string
          asset?: string
          chain?: string
          contract_address?: string | null
          created_at?: string
          decimals?: number
          id?: string
          is_active?: boolean
          label?: string
          min_confirmations?: number
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          accent: string
          category: string | null
          created_at: string
          credential_format: string
          description: string | null
          icon_letter: string
          id: string
          is_active: boolean
          name: string
          price_usd: number
          slug: string
          sort_order: number
          subtitle: string | null
        }
        Insert: {
          accent?: string
          category?: string | null
          created_at?: string
          credential_format?: string
          description?: string | null
          icon_letter?: string
          id?: string
          is_active?: boolean
          name: string
          price_usd?: number
          slug: string
          sort_order?: number
          subtitle?: string | null
        }
        Update: {
          accent?: string
          category?: string | null
          created_at?: string
          credential_format?: string
          description?: string | null
          icon_letter?: string
          id?: string
          is_active?: boolean
          name?: string
          price_usd?: number
          slug?: string
          sort_order?: number
          subtitle?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_blocked: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_blocked?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_blocked?: boolean
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accepted_coins: string
          auto_deliver: boolean
          footer_note: string
          heading: string
          id: boolean
          payment_window_minutes: number
          store_name: string
          support_email: string | null
          support_hours: string | null
          tagline: string
          telegram_handle: string | null
          updated_at: string
        }
        Insert: {
          accepted_coins?: string
          auto_deliver?: boolean
          footer_note?: string
          heading?: string
          id?: boolean
          payment_window_minutes?: number
          store_name?: string
          support_email?: string | null
          support_hours?: string | null
          tagline?: string
          telegram_handle?: string | null
          updated_at?: string
        }
        Update: {
          accepted_coins?: string
          auto_deliver?: boolean
          footer_note?: string
          heading?: string
          id?: boolean
          payment_window_minutes?: number
          store_name?: string
          support_email?: string | null
          support_hours?: string | null
          tagline?: string
          telegram_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          payload: string
          product_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["stock_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          payload: string
          product_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["stock_status"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          payload?: string
          product_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["stock_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_counts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_by_admin: boolean
          read_by_user: boolean
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_stock_counts: {
        Row: {
          available: number | null
          product_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _check_server_key: { Args: { _hash: string }; Returns: undefined }
      available_stock: { Args: { _product_id: string }; Returns: number }
      claim_admin: { Args: never; Returns: boolean }
      deliver_order: { Args: { _order_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      server_order_update: {
        Args: {
          _action: string
          _key: string
          _order_id: string
          _tx_hash: string
        }
        Returns: string
      }
      server_place_order: {
        Args: {
          _expected: number
          _key: string
          _product_id: string
          _quantity: number
          _total_usd: number
          _unit_price: number
          _wallet_id: string
          _window_minutes: number
        }
        Returns: string
      }
      set_server_key_hash: { Args: { _hash: string }; Returns: undefined }
      tx_hash_used: { Args: { _hashes: string[] }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "paid"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "failed"
      stock_status: "available" | "sold"
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
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "paid",
        "delivered",
        "cancelled",
        "refunded",
        "failed",
      ],
      stock_status: ["available", "sold"],
    },
  },
} as const
