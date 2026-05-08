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
      analysis_results: {
        Row: {
          base_rent_psf: number | null
          cam_charges: string | null
          created_at: string | null
          exclusivity_rights: string | null
          id: string
          lease_area_unit: string | null
          lease_id: string
          monthly_lease_payment: number | null
          permissibility_status: string | null
          raw_ai_response: Json | null
          renewal_options: string | null
          responsibilities_summary: string | null
          restrictions_summary: string | null
          summary_text: string | null
          term_length_months: number | null
          termination_rights: string | null
          total_leased_area: number | null
          updated_at: string | null
        }
        Insert: {
          base_rent_psf?: number | null
          cam_charges?: string | null
          created_at?: string | null
          exclusivity_rights?: string | null
          id?: string
          lease_area_unit?: string | null
          lease_id: string
          monthly_lease_payment?: number | null
          permissibility_status?: string | null
          raw_ai_response?: Json | null
          renewal_options?: string | null
          responsibilities_summary?: string | null
          restrictions_summary?: string | null
          summary_text?: string | null
          term_length_months?: number | null
          termination_rights?: string | null
          total_leased_area?: number | null
          updated_at?: string | null
        }
        Update: {
          base_rent_psf?: number | null
          cam_charges?: string | null
          created_at?: string | null
          exclusivity_rights?: string | null
          id?: string
          lease_area_unit?: string | null
          lease_id?: string
          monthly_lease_payment?: number | null
          permissibility_status?: string | null
          raw_ai_response?: Json | null
          renewal_options?: string | null
          responsibilities_summary?: string | null
          restrictions_summary?: string | null
          summary_text?: string | null
          term_length_months?: number | null
          termination_rights?: string | null
          total_leased_area?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          currency: string
          end_at: string | null
          end_date: string
          id: string
          kind: string | null
          payment_status: string
          price_total: number
          property_id: string
          proposal_id: string | null
          service_credit_applied_at: string | null
          service_credit_applied_cents: number
          service_credit_applied_pi_id: string | null
          start_at: string | null
          start_date: string
          status: string
          stripe_client_secret: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          end_at?: string | null
          end_date: string
          id?: string
          kind?: string | null
          payment_status?: string
          price_total: number
          property_id: string
          proposal_id?: string | null
          service_credit_applied_at?: string | null
          service_credit_applied_cents?: number
          service_credit_applied_pi_id?: string | null
          start_at?: string | null
          start_date: string
          status?: string
          stripe_client_secret?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          end_at?: string | null
          end_date?: string
          id?: string
          kind?: string | null
          payment_status?: string
          price_total?: number
          property_id?: string
          proposal_id?: string | null
          service_credit_applied_at?: string | null
          service_credit_applied_cents?: number
          service_credit_applied_pi_id?: string | null
          start_at?: string | null
          start_date?: string
          status?: string
          stripe_client_secret?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          created_at: string
          function: string
          id: string
          ip: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          function: string
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          function?: string
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      faq_categories: {
        Row: {
          created_at: string
          id: string
          position: number
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      faq_entries: {
        Row: {
          answer_md: string
          category_id: string | null
          created_at: string
          id: string
          position: number
          published: boolean
          question: string
          search_tsv: unknown | null
          tags: string[]
        }
        Insert: {
          answer_md: string
          category_id?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question: string
          search_tsv?: unknown | null
          tags?: string[]
        }
        Update: {
          answer_md?: string
          category_id?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question?: string
          search_tsv?: unknown | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "faq_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "faq_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          amenities: string[] | null
          base_uri: string
          capacity: number | null
          created_at: string | null
          currency: string | null
          daily_enabled: boolean | null
          description: string | null
          fast_responder: boolean | null
          flexible_commission_rate: number | null
          floor_plans: Json | null
          host_first_name: string | null
          hourly_enabled: boolean | null
          id: string
          ideal_for_christmas: boolean | null
          ideal_uses: string[] | null
          is_always_opened: boolean | null
          is_for_lease: boolean | null
          is_for_revenue_share: boolean | null
          is_for_sale: boolean | null
          is_hourly_enabled: boolean | null
          is_premium: boolean | null
          last_invoice_completed_at: string | null
          latitude: number | null
          lease_period: string | null
          lease_price: number | null
          location_type: string | null
          longitude: number | null
          metro_area: string | null
          monthly_discount: string | null
          monthly_enabled: boolean | null
          monthly_rate_value: number | null
          neighborhood: string | null
          operated_by_storefront: boolean | null
          operating_hours: string | null
          photos: string[] | null
          price_day_weekend: number | null
          price_hour_weekend: number | null
          price_per_day: number | null
          price_per_hour: number | null
          property_type: string | null
          recent_inquiry_count: number | null
          sale_price: number | null
          scraped_at: string | null
          square_feet: number | null
          title: string | null
          updated_at: string | null
          virtual_tour_url: string | null
          weekend_enabled: boolean | null
          weekly_discount: string | null
          weekly_enabled: boolean | null
          weekly_rate_value: number | null
          yearly_discount: string | null
          yearly_rate_value: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          amenities?: string[] | null
          base_uri: string
          capacity?: number | null
          created_at?: string | null
          currency?: string | null
          daily_enabled?: boolean | null
          description?: string | null
          fast_responder?: boolean | null
          flexible_commission_rate?: number | null
          floor_plans?: Json | null
          host_first_name?: string | null
          hourly_enabled?: boolean | null
          id?: string
          ideal_for_christmas?: boolean | null
          ideal_uses?: string[] | null
          is_always_opened?: boolean | null
          is_for_lease?: boolean | null
          is_for_revenue_share?: boolean | null
          is_for_sale?: boolean | null
          is_hourly_enabled?: boolean | null
          is_premium?: boolean | null
          last_invoice_completed_at?: string | null
          latitude?: number | null
          lease_period?: string | null
          lease_price?: number | null
          location_type?: string | null
          longitude?: number | null
          metro_area?: string | null
          monthly_discount?: string | null
          monthly_enabled?: boolean | null
          monthly_rate_value?: number | null
          neighborhood?: string | null
          operated_by_storefront?: boolean | null
          operating_hours?: string | null
          photos?: string[] | null
          price_day_weekend?: number | null
          price_hour_weekend?: number | null
          price_per_day?: number | null
          price_per_hour?: number | null
          property_type?: string | null
          recent_inquiry_count?: number | null
          sale_price?: number | null
          scraped_at?: string | null
          square_feet?: number | null
          title?: string | null
          updated_at?: string | null
          virtual_tour_url?: string | null
          weekend_enabled?: boolean | null
          weekly_discount?: string | null
          weekly_enabled?: boolean | null
          weekly_rate_value?: number | null
          yearly_discount?: string | null
          yearly_rate_value?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          amenities?: string[] | null
          base_uri?: string
          capacity?: number | null
          created_at?: string | null
          currency?: string | null
          daily_enabled?: boolean | null
          description?: string | null
          fast_responder?: boolean | null
          flexible_commission_rate?: number | null
          floor_plans?: Json | null
          host_first_name?: string | null
          hourly_enabled?: boolean | null
          id?: string
          ideal_for_christmas?: boolean | null
          ideal_uses?: string[] | null
          is_always_opened?: boolean | null
          is_for_lease?: boolean | null
          is_for_revenue_share?: boolean | null
          is_for_sale?: boolean | null
          is_hourly_enabled?: boolean | null
          is_premium?: boolean | null
          last_invoice_completed_at?: string | null
          latitude?: number | null
          lease_period?: string | null
          lease_price?: number | null
          location_type?: string | null
          longitude?: number | null
          metro_area?: string | null
          monthly_discount?: string | null
          monthly_enabled?: boolean | null
          monthly_rate_value?: number | null
          neighborhood?: string | null
          operated_by_storefront?: boolean | null
          operating_hours?: string | null
          photos?: string[] | null
          price_day_weekend?: number | null
          price_hour_weekend?: number | null
          price_per_day?: number | null
          price_per_hour?: number | null
          property_type?: string | null
          recent_inquiry_count?: number | null
          sale_price?: number | null
          scraped_at?: string | null
          square_feet?: number | null
          title?: string | null
          updated_at?: string | null
          virtual_tour_url?: string | null
          weekend_enabled?: boolean | null
          weekly_discount?: string | null
          weekly_enabled?: boolean | null
          weekly_rate_value?: number | null
          yearly_discount?: string | null
          yearly_rate_value?: number | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          created_at: string
          end_at: string | null
          end_date: string
          headcount: number | null
          id: string
          initiator_closed: boolean
          initiator_deleted: boolean
          initiator_last_read_message_id: string | null
          message: string
          property_id: string
          responder_closed: boolean
          responder_deleted: boolean
          responder_last_read_message_id: string | null
          selected_adjustment_ids: string[] | null
          start_at: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          end_date: string
          headcount?: number | null
          id?: string
          initiator_closed?: boolean
          initiator_deleted?: boolean
          initiator_last_read_message_id?: string | null
          message: string
          property_id: string
          responder_closed?: boolean
          responder_deleted?: boolean
          responder_last_read_message_id?: string | null
          selected_adjustment_ids?: string[] | null
          start_at?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          end_date?: string
          headcount?: number | null
          id?: string
          initiator_closed?: boolean
          initiator_deleted?: boolean
          initiator_last_read_message_id?: string | null
          message?: string
          property_id?: string
          responder_closed?: boolean
          responder_deleted?: boolean
          responder_last_read_message_id?: string | null
          selected_adjustment_ids?: string[] | null
          start_at?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_initiator_last_read_message"
            columns: ["initiator_last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_responder_last_read_message"
            columns: ["responder_last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_clauses: {
        Row: {
          clause_type: string
          confidence_score: number | null
          created_at: string | null
          id: string
          lease_id: string
          original_text: string
          page_number: number | null
          risk_flag: string
          summary: string
        }
        Insert: {
          clause_type: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          lease_id: string
          original_text: string
          page_number?: number | null
          risk_flag?: string
          summary: string
        }
        Update: {
          clause_type?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          lease_id?: string
          original_text?: string
          page_number?: number | null
          risk_flag?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_clauses_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          updated_at: string | null
          upload_status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          updated_at?: string | null
          upload_status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          updated_at?: string | null
          upload_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          inquiry_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          inquiry_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_adjustments: {
        Row: {
          created_at: string
          data: Json
          id: string
          organization_id: string
          sort_order: number
          type: Database["public"]["Enums"]["org_adjustment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          organization_id: string
          sort_order?: number
          type: Database["public"]["Enums"]["org_adjustment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          organization_id?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["org_adjustment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_credit_ledger: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          id: string
          organization_id: string
          payment_intent_id: string
          reason: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          id?: string
          organization_id: string
          payment_intent_id: string
          reason?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          payment_intent_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_credit_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_credit_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          about_brand: string | null
          brevo_company_id: string | null
          business_type: string | null
          charges_enabled: boolean | null
          created_at: string
          default_timezone: string | null
          id: string
          name: string
          payouts_enabled: boolean | null
          service_credit: number
          slug: string | null
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          about_brand?: string | null
          brevo_company_id?: string | null
          business_type?: string | null
          charges_enabled?: boolean | null
          created_at?: string
          default_timezone?: string | null
          id?: string
          name: string
          payouts_enabled?: boolean | null
          service_credit?: number
          slug?: string | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          about_brand?: string | null
          brevo_company_id?: string | null
          business_type?: string | null
          charges_enabled?: boolean | null
          created_at?: string
          default_timezone?: string | null
          id?: string
          name?: string
          payouts_enabled?: boolean | null
          service_credit?: number
          slug?: string | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          content: string
          created_at: string
          id: string
          page_type: string
          slug: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          page_type?: string
          slug: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          page_type?: string
          slug?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brevo_opt_in: boolean | null
          brevo_opt_in_ts: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean | null
          password_set: boolean
          phone: string | null
          primary_organization_id: string | null
          survey_answers: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          brevo_opt_in?: boolean | null
          brevo_opt_in_ts?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_admin?: boolean | null
          password_set?: boolean
          phone?: string | null
          primary_organization_id?: string | null
          survey_answers?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          brevo_opt_in?: boolean | null
          brevo_opt_in_ts?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean | null
          password_set?: boolean
          phone?: string | null
          primary_organization_id?: string | null
          survey_answers?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_organization_id_fkey"
            columns: ["primary_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_city: string
          address_country: string
          address_postal_code: string
          address_state: string
          address_street: string
          amenities: string[]
          applied_adjustment_ids: string[] | null
          applied_adjustment_tokens: string[] | null
          capacity: number | null
          created_at: string
          currency: string | null
          description: string
          downloadable_files: Json | null
          fast_responder: boolean | null
          featured: boolean | null
          fee_description: string | null
          fee_type: string | null
          fee_value: number | null
          iana_timezone: string | null
          id: string
          images: string[]
          inquire_for_pricing: boolean
          latitude: number
          location_type: string | null
          longitude: number
          metro_area: string | null
          monthly_percent: number | null
          monthly_rate: number | null
          monthly_rate_type: string | null
          monthly_rate_value: number | null
          neighborhood: string | null
          organization_id: string | null
          price_day_weekend: number | null
          price_hour_weekend: number | null
          price_per_day: number | null
          price_per_hour: number | null
          property_type: string
          published: boolean | null
          space_attributes: string[] | null
          square_feet: number
          tax_rate: number | null
          title: string
          updated_at: string
          venue_id: string
          virtual_tour_url: string | null
          weekly_percent: number | null
          weekly_rate: number | null
          weekly_rate_type: string | null
          weekly_rate_value: number | null
          yearly_percent: number | null
          yearly_rate: number | null
          yearly_rate_type: string | null
          yearly_rate_value: number | null
        }
        Insert: {
          address_city: string
          address_country: string
          address_postal_code: string
          address_state: string
          address_street: string
          amenities: string[]
          applied_adjustment_ids?: string[] | null
          applied_adjustment_tokens?: string[] | null
          capacity?: number | null
          created_at?: string
          currency?: string | null
          description: string
          downloadable_files?: Json | null
          fast_responder?: boolean | null
          featured?: boolean | null
          fee_description?: string | null
          fee_type?: string | null
          fee_value?: number | null
          iana_timezone?: string | null
          id?: string
          images: string[]
          inquire_for_pricing?: boolean
          latitude: number
          location_type?: string | null
          longitude: number
          metro_area?: string | null
          monthly_percent?: number | null
          monthly_rate?: number | null
          monthly_rate_type?: string | null
          monthly_rate_value?: number | null
          neighborhood?: string | null
          organization_id?: string | null
          price_day_weekend?: number | null
          price_hour_weekend?: number | null
          price_per_day?: number | null
          price_per_hour?: number | null
          property_type: string
          published?: boolean | null
          space_attributes?: string[] | null
          square_feet: number
          tax_rate?: number | null
          title: string
          updated_at?: string
          venue_id: string
          virtual_tour_url?: string | null
          weekly_percent?: number | null
          weekly_rate?: number | null
          weekly_rate_type?: string | null
          weekly_rate_value?: number | null
          yearly_percent?: number | null
          yearly_rate?: number | null
          yearly_rate_type?: string | null
          yearly_rate_value?: number | null
        }
        Update: {
          address_city?: string
          address_country?: string
          address_postal_code?: string
          address_state?: string
          address_street?: string
          amenities?: string[]
          applied_adjustment_ids?: string[] | null
          applied_adjustment_tokens?: string[] | null
          capacity?: number | null
          created_at?: string
          currency?: string | null
          description?: string
          downloadable_files?: Json | null
          fast_responder?: boolean | null
          featured?: boolean | null
          fee_description?: string | null
          fee_type?: string | null
          fee_value?: number | null
          iana_timezone?: string | null
          id?: string
          images?: string[]
          inquire_for_pricing?: boolean
          latitude?: number
          location_type?: string | null
          longitude?: number
          metro_area?: string | null
          monthly_percent?: number | null
          monthly_rate?: number | null
          monthly_rate_type?: string | null
          monthly_rate_value?: number | null
          neighborhood?: string | null
          organization_id?: string | null
          price_day_weekend?: number | null
          price_hour_weekend?: number | null
          price_per_day?: number | null
          price_per_hour?: number | null
          property_type?: string
          published?: boolean | null
          space_attributes?: string[] | null
          square_feet?: number
          tax_rate?: number | null
          title?: string
          updated_at?: string
          venue_id?: string
          virtual_tour_url?: string | null
          weekly_percent?: number | null
          weekly_rate?: number | null
          weekly_rate_type?: string | null
          weekly_rate_value?: number | null
          yearly_percent?: number | null
          yearly_rate?: number | null
          yearly_rate_type?: string | null
          yearly_rate_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      property_availability: {
        Row: {
          created_at: string
          end_date: string
          id: string
          property_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          property_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          property_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_availability_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_schedule: {
        Row: {
          available_from: string | null
          available_until: string | null
          created_at: string
          daily_schedule: Json
          ical_url: string | null
          id: string
          limit_availability: boolean | null
          property_id: string
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          daily_schedule?: Json
          ical_url?: string | null
          id?: string
          limit_availability?: boolean | null
          property_id: string
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          daily_schedule?: Json
          ical_url?: string | null
          id?: string
          limit_availability?: boolean | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_schedule_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          currency: string
          expires_at: string
          id: string
          inquiry_id: string
          message: string
          price_total: number
          request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expires_at: string
          id?: string
          inquiry_id: string
          message: string
          price_total: number
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          inquiry_id?: string
          message?: string
          price_total?: number
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          content: string
          created_at: string
          id: string
          responder_id: string
          review_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          responder_id: string
          review_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          responder_id?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          property_id: string
          rating: number
          review_eligibility: Json
          reviewer_id: string
          status: string
          updated_at: string
          verified_booking: boolean
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          property_id: string
          rating: number
          review_eligibility?: Json
          reviewer_id: string
          status?: string
          updated_at?: string
          verified_booking?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          property_id?: string
          rating?: number
          review_eligibility?: Json
          reviewer_id?: string
          status?: string
          updated_at?: string
          verified_booking?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_notifications: {
        Row: {
          created_at: string
          email_type: string
          has_attachments: boolean | null
          id: string
          recipient_email: string
          request_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          has_attachments?: boolean | null
          id?: string
          recipient_email: string
          request_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          has_attachments?: boolean | null
          id?: string
          recipient_email?: string
          request_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          booking_id: string | null
          created_at: string | null
          error: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payment_intent_id: string | null
          request_body: string | null
          status: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payment_intent_id?: string | null
          request_body?: string | null
          status?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payment_intent_id?: string | null
          request_body?: string | null
          status?: string | null
        }
        Relationships: []
      }
      webhook_notification_log: {
        Row: {
          booking_id: string | null
          created_at: string | null
          error: string | null
          has_attachments: boolean | null
          id: string
          notification_type: string | null
          payment_intent_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          response_data: Json | null
          status: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          has_attachments?: boolean | null
          id?: string
          notification_type?: string | null
          payment_intent_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          response_data?: Json | null
          status?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          has_attachments?: boolean | null
          id?: string
          notification_type?: string | null
          payment_intent_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          response_data?: Json | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public_view: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _normalize_slug: {
        Args: { s: string }
        Returns: string
      }
      add_user_to_primary_org: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      apply_org_service_credit: {
        Args: {
          p_amount_cents: number
          p_booking_id: string
          p_org_id: string
          p_payment_intent_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      auth_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_manage_property_schedule: {
        Args: { _property_id: string }
        Returns: boolean
      }
      claim_pending_inquiry_rpc: {
        Args:
          | {
              p_end_at: string
              p_end_date: string
              p_headcount: number
              p_message: string
              p_property_id: string
              p_selected_adjustment_ids: string[]
              p_start_at: string
              p_start_date: string
              p_user_id: string
            }
          | {
              p_end_at: string
              p_end_date: string
              p_headcount: number
              p_message: string
              p_property_id: string
              p_selected_adjustment_ids: string[]
              p_start_at: string
              p_start_date: string
              p_user_id: string
            }
        Returns: string
      }
      cleanup_edge_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_booking_calendar_attachment: {
        Args: {
          booking_id: string
          end_date: string
          location?: string
          property_title: string
          start_date: string
        }
        Returns: Json
      }
      create_booking_calendar_attachment_v2: {
        Args: {
          booking_id: string
          end_date: string
          location?: string
          property_title: string
          start_date: string
        }
        Returns: Json
      }
      create_booking_calendar_attachment_v3: {
        Args: {
          booking_id: string
          end_date: string
          location?: string
          property_title: string
          start_date: string
        }
        Returns: Json
      }
      create_booking_calendar_attachment_v4: {
        Args:
          | {
              booking_id: string
              end_date: string
              location?: string
              property_title: string
              start_date: string
            }
          | { booking_id: string; location: string; property_title: string }
        Returns: Json
      }
      create_booking_calendar_attachment_v5: {
        Args: {
          booking_id: string
          end_date?: string
          location?: string
          property_title: string
          start_date?: string
        }
        Returns: Json
      }
      create_booking_calendar_attachment_v6: {
        Args:
          | { booking_id: string }
          | {
              booking_id: string
              end_date: string
              location?: string
              property_title: string
              start_date: string
            }
          | { booking_id: string; location: string; property_title: string }
        Returns: Json
      }
      create_booking_ics_attachment: {
        Args: {
          booking_id: string
          end_date: string
          location: string
          property_title: string
          start_date: string
        }
        Returns: Json
      }
      create_ics_calendar_content: {
        Args: {
          description: string
          end_date: string
          event_title: string
          location: string
          start_date: string
        }
        Returns: string
      }
      create_ics_calendar_content_v3: {
        Args: {
          description?: string
          end_date: string
          event_title: string
          is_all_day?: boolean
          location?: string
          start_date: string
        }
        Returns: string
      }
      create_ics_calendar_content_v4: {
        Args: {
          description?: string
          end_date: string
          event_title: string
          is_all_day?: boolean
          location?: string
          start_date: string
        }
        Returns: string
      }
      create_ics_calendar_content_v5: {
        Args: {
          description?: string
          end_date: string
          event_title: string
          is_all_day?: boolean
          location?: string
          start_date: string
          uid?: string
        }
        Returns: string
      }
      create_user_profile_and_org: {
        Args: { user_email: string; user_id: string; user_meta_data?: Json }
        Returns: undefined
      }
      debug_user_org_membership: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_member: boolean
          member_role: string
          org_name: string
          primary_org_id: string
          user_id: string
        }[]
      }
      encode_ics_content: {
        Args: { ics_content: string }
        Returns: string
      }
      encode_ics_content_safely: {
        Args: { ics_content: string }
        Returns: string
      }
      fix_missing_org_memberships: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fix_webhook_property_query: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_ics_calendar_content: {
        Args: {
          description?: string
          end_date: string
          location?: string
          start_date: string
          title: string
        }
        Returns: string
      }
      get_frontend_base_url: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_system_setting: {
        Args: { setting_key: string }
        Returns: string
      }
      get_user_profile: {
        Args: { user_id: string }
        Returns: Json
      }
      handle_new_user: {
        Args: { email: string; meta?: Json; user_id: string }
        Returns: Json
      }
      insert_inquiry_for_user: {
        Args: {
          p_end_at: string | null
          p_end_date: string
          p_headcount: number | null
          p_message: string
          p_property_id: string
          p_selected_adjustment_ids: string[] | null
          p_start_at: string | null
          p_start_date: string
          p_user_id: string
        }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_member_with_role: {
        Args: { allowed_roles: string[]; org_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      promote_invites_for_email: {
        Args: { p_email: string }
        Returns: undefined
      }
      rename_organization: {
        Args: { p_new_name: string; p_org_id: string }
        Returns: {
          id: string
          name: string
          slug: string
          updated_at: string
        }[]
      }
      safe_encode_base64_text: {
        Args: { input_text: string }
        Returns: string
      }
      slugify: {
        Args: { txt: string }
        Returns: string
      }
      validate_email_attachment_object: {
        Args: { content: string; content_type?: string; name: string }
        Returns: Json
      }
    }
    Enums: {
      org_adjustment_type:
        | "user_selected_discount"
        | "capacity_surcharge"
        | "off_hours_adjustment"
        | "off_days_adjustment"
      per_unit:
        | "per_hour"
        | "per_day"
        | "per_week"
        | "per_month"
        | "per_booking"
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
      org_adjustment_type: [
        "user_selected_discount",
        "capacity_surcharge",
        "off_hours_adjustment",
        "off_days_adjustment",
      ],
      per_unit: ["per_hour", "per_day", "per_week", "per_month", "per_booking"],
    },
  },
} as const
