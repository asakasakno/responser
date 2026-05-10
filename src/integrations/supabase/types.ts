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
      admin_anomalies: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          payload: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expire_at: string
          hit_count: number
          id: string
          response: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expire_at?: string
          hit_count?: number
          id?: string
          response: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expire_at?: string
          hit_count?: number
          id?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beta_applications: {
        Row: {
          applied_at: string | null
          business_name: string | null
          consent: boolean
          created_at: string
          email: string
          error_message: string | null
          id: string
          industry: string | null
          matched_user_id: string | null
          needed_features: string[]
          pain_point: string | null
          platforms: string[]
          raw_payload: Json
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          business_name?: string | null
          consent?: boolean
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          industry?: string | null
          matched_user_id?: string | null
          needed_features?: string[]
          pain_point?: string | null
          platforms?: string[]
          raw_payload?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          business_name?: string | null
          consent?: boolean
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          industry?: string | null
          matched_user_id?: string | null
          needed_features?: string[]
          pain_point?: string | null
          platforms?: string[]
          raw_payload?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_inquiries: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          billing_order_id: string | null
          coupon_id: string
          discount_amount: number
          final_amount: number
          id: string
          original_amount: number
          target_type: string
          used_at: string
          user_id: string
        }
        Insert: {
          billing_order_id?: string | null
          coupon_id: string
          discount_amount: number
          final_amount: number
          id?: string
          original_amount: number
          target_type: string
          used_at?: string
          user_id: string
        }
        Update: {
          billing_order_id?: string | null
          coupon_id?: string
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          target_type?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          coupon_code: string
          coupon_name: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_total_uses: number | null
          max_use_per_user: number
          min_purchase_amount: number | null
          reward_energy: number
          reward_energy_expire_days: number | null
          starts_at: string | null
          target_plan: string | null
          target_type: string
          total_uses: number
          updated_at: string
        }
        Insert: {
          coupon_code: string
          coupon_name: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_total_uses?: number | null
          max_use_per_user?: number
          min_purchase_amount?: number | null
          reward_energy?: number
          reward_energy_expire_days?: number | null
          starts_at?: string | null
          target_plan?: string | null
          target_type?: string
          total_uses?: number
          updated_at?: string
        }
        Update: {
          coupon_code?: string
          coupon_name?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_total_uses?: number | null
          max_use_per_user?: number
          min_purchase_amount?: number | null
          reward_energy?: number
          reward_energy_expire_days?: number | null
          starts_at?: string | null
          target_plan?: string | null
          target_type?: string
          total_uses?: number
          updated_at?: string
        }
        Relationships: []
      }
      cs_faq_entries: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          keywords: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cta_links: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          kind: string
          label: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind: string
          label: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      energy_grants: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expire_at: string | null
          id: string
          reason: string
          remaining: number
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          expire_at?: string | null
          id?: string
          reason: string
          remaining: number
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expire_at?: string | null
          id?: string
          reason?: string
          remaining?: number
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      energy_packs: {
        Row: {
          active: boolean
          energy: number
          id: string
          price: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          energy: number
          id: string
          price: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          energy?: number
          id?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      energy_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      generate_refund_attempts: {
        Row: {
          claimed_at: string
          completed_at: string | null
          id: string
          refund_error: string | null
          refunded: boolean
          reservation_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          completed_at?: string | null
          id?: string
          refund_error?: string | null
          refunded?: boolean
          reservation_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          completed_at?: string | null
          id?: string
          refund_error?: string | null
          refunded?: boolean
          reservation_id?: string
          user_id?: string
        }
        Relationships: []
      }
      generate_request_reservations: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          action?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string
          id: string
          input_text: string
          is_favorite: boolean
          output_text: string
          product_id: string | null
          type: Database["public"]["Enums"]["generation_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_text: string
          is_favorite?: boolean
          output_text: string
          product_id?: string | null
          type: Database["public"]["Enums"]["generation_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_text?: string
          is_favorite?: boolean
          output_text?: string
          product_id?: string | null
          type?: Database["public"]["Enums"]["generation_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          payment_method: string | null
          product_name: string
          refund_amount: number | null
          refund_note: string | null
          refund_status: string | null
          refunded_at: string | null
          source_ref: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          payment_method?: string | null
          product_name: string
          refund_amount?: number | null
          refund_note?: string | null
          refund_status?: string | null
          refunded_at?: string | null
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          payment_method?: string | null
          product_name?: string
          refund_amount?: number | null
          refund_note?: string | null
          refund_status?: string | null
          refunded_at?: string | null
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_category: string | null
          company_name: string | null
          created_at: string
          email: string
          energy_balance: number
          id: string
          max_energy: number
          name: string | null
          phone: string | null
          platforms: string[]
          provider: string
          provider_user_id: string | null
          referral_code: string | null
          suspended: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          business_category?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          energy_balance?: number
          id?: string
          max_energy?: number
          name?: string | null
          phone?: string | null
          platforms?: string[]
          provider?: string
          provider_user_id?: string | null
          referral_code?: string | null
          suspended?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          business_category?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          energy_balance?: number
          id?: string
          max_energy?: number
          name?: string | null
          phone?: string | null
          platforms?: string[]
          provider?: string
          provider_user_id?: string | null
          referral_code?: string | null
          suspended?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          payment_reward_given: boolean
          referred_user_id: string
          referrer_id: string
          reward_given: boolean
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_reward_given?: boolean
          referred_user_id: string
          referrer_id: string
          reward_given?: boolean
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_reward_given?: boolean
          referred_user_id?: string
          referrer_id?: string
          reward_given?: boolean
          status?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          reward_key: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reward_key: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reward_key?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          beta_source: string | null
          beta_until: string | null
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          is_beta: boolean
          payment_enabled: boolean
          plan: Database["public"]["Enums"]["plan_type"]
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          beta_source?: string | null
          beta_until?: string | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_beta?: boolean
          payment_enabled?: boolean
          plan?: Database["public"]["Enums"]["plan_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          beta_source?: string | null
          beta_until?: string | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_beta?: boolean
          payment_enabled?: boolean
          plan?: Database["public"]["Enums"]["plan_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      usage: {
        Row: {
          count: number
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_identity_links: {
        Row: {
          email_verified: boolean
          id: string
          is_active: boolean
          linked_at: string
          provider: string
          provider_email: string | null
          provider_user_id: string | null
          unlinked_at: string | null
          user_id: string
        }
        Insert: {
          email_verified?: boolean
          id?: string
          is_active?: boolean
          linked_at?: string
          provider: string
          provider_email?: string | null
          provider_user_id?: string | null
          unlinked_at?: string | null
          user_id: string
        }
        Update: {
          email_verified?: boolean
          id?: string
          is_active?: boolean
          linked_at?: string
          provider?: string
          provider_email?: string | null
          provider_user_id?: string | null
          unlinked_at?: string | null
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
      user_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_voice_samples: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_partial_recover_energy: {
        Args: {
          _payment_id: string
          _reason: string
          _requested: number
          _user_id: string
        }
        Returns: Json
      }
      admin_resolve_anomaly: {
        Args: { _anomaly_id: string; _note: string }
        Returns: Json
      }
      admin_spend_energy: {
        Args: {
          _amount: number
          _description?: string
          _reason: string
          _user_id: string
        }
        Returns: Json
      }
      check_plan_rate_limit: { Args: { _action: string }; Returns: Json }
      check_rate_limit: {
        Args: { _action: string; _max_per_second?: number; _user_id: string }
        Returns: boolean
      }
      claim_reward: {
        Args: { _amount: number; _description: string; _reward_key: string }
        Returns: Json
      }
      cleanup_ai_response_cache: { Args: never; Returns: number }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_energy_transactions_global: { Args: never; Returns: number }
      complete_generate_refund: {
        Args: {
          _refund_error?: string
          _refunded: boolean
          _reservation_id: string
        }
        Returns: Json
      }
      complete_generate_request: {
        Args: { _error_code?: string; _reservation_id: string; _status: string }
        Returns: Json
      }
      consume_coupon: {
        Args: {
          _billing_order_id: string
          _coupon_id: string
          _discount_amount: number
          _final_amount: number
          _original_amount: number
          _target_type: string
          _user_id: string
        }
        Returns: Json
      }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_abnormal_usage: { Args: never; Returns: number }
      detect_duplicate_payments: { Args: never; Returns: number }
      detect_missing_credits: { Args: never; Returns: number }
      detect_refund_failures: { Args: never; Returns: number }
      earn_energy:
        | {
            Args: {
              _amount: number
              _description?: string
              _reason: string
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _amount: number
              _description?: string
              _expire_days?: number
              _reason: string
              _source?: string
              _user_id: string
            }
            Returns: Json
          }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_energy_grants: { Args: { _user_id: string }; Returns: undefined }
      get_energy_balance: { Args: { _user_id: string }; Returns: number }
      grant_referral_payment_bonus: {
        Args: { _user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: { Args: never; Returns: undefined }
      log_audit: {
        Args: { _action: string; _details?: Json; _severity?: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_energy_coupon: { Args: { _code: string }; Returns: Json }
      refund_energy: {
        Args: { _amount: number; _description?: string; _reason: string }
        Returns: Json
      }
      reserve_generate_request: {
        Args: { _max_per_second?: number; _per_day?: number; _per_min?: number }
        Returns: Json
      }
      run_admin_anomaly_scan: { Args: never; Returns: Json }
      spend_energy: {
        Args: { _amount: number; _description?: string; _reason: string }
        Returns: Json
      }
      try_claim_generate_refund: {
        Args: { _reservation_id: string }
        Returns: Json
      }
      validate_coupon: {
        Args: {
          _amount: number
          _code: string
          _target_plan?: string
          _target_type: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      generation_type: "review" | "inquiry" | "claim"
      plan_type: "free" | "basic" | "pro"
      subscription_status: "active" | "cancelled" | "expired"
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
      app_role: ["admin", "moderator", "user"],
      generation_type: ["review", "inquiry", "claim"],
      plan_type: ["free", "basic", "pro"],
      subscription_status: ["active", "cancelled", "expired"],
    },
  },
} as const
