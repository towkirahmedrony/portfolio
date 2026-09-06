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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          read_at: string | null
          replied_at: string | null
          status: Database["public"]["Enums"]["contact_status"]
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          read_at?: string | null
          replied_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          read_at?: string | null
          replied_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          subject?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          client_id: string
          created_at: string
          currency: string | null
          discount_total: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          paid_at: string | null
          project_id: string
          quote_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          client_id: string
          created_at?: string
          currency?: string | null
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          paid_at?: string | null
          project_id: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          client_id?: string
          created_at?: string
          currency?: string | null
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          paid_at?: string | null
          project_id?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_messages: boolean
          email_payments: boolean
          email_project_updates: boolean
          email_quotes: boolean
          email_referrals: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_messages?: boolean
          email_payments?: boolean
          email_project_updates?: boolean
          email_quotes?: boolean
          email_referrals?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_messages?: boolean
          email_payments?: boolean
          email_project_updates?: boolean
          email_quotes?: boolean
          email_referrals?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_form_fields: {
        Row: {
          conditional: Json
          constraints: Json
          created_at: string
          default_value: Json | null
          field_key: string
          hint: string | null
          id: string
          input_type: string
          is_active: boolean
          label: string
          options_group: string | null
          placeholder: string | null
          required: boolean
          sort_order: number
          step_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          conditional?: Json
          constraints?: Json
          created_at?: string
          default_value?: Json | null
          field_key: string
          hint?: string | null
          id?: string
          input_type: string
          is_active?: boolean
          label: string
          options_group?: string | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          step_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          conditional?: Json
          constraints?: Json
          created_at?: string
          default_value?: Json | null
          field_key?: string
          hint?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          label?: string
          options_group?: string | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          step_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_form_fields_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "order_form_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      order_form_options: {
        Row: {
          created_at: string
          description: string | null
          group: string
          id: string
          is_active: boolean
          label: string
          meta: Json
          requires_text: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group: string
          id?: string
          is_active?: boolean
          label: string
          meta?: Json
          requires_text?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group?: string
          id?: string
          is_active?: boolean
          label?: string
          meta?: Json
          requires_text?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_form_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      payment_schedule: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          label: string
          project_id: string
          sequence: number
          status: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          label: string
          project_id: string
          sequence: number
          status?: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          label?: string
          project_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedule_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          invoice_id: string
          paid_at: string | null
          payment_method: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          project_id: string
          provider: string | null
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          project_id: string
          provider?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          project_id?: string
          provider?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_images: {
        Row: {
          alt_text: string | null
          id: string
          image_url: string
          portfolio_project_id: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          id?: string
          image_url: string
          portfolio_project_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          id?: string
          image_url?: string
          portfolio_project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_images_portfolio_project_id_fkey"
            columns: ["portfolio_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          featured: boolean
          github_url: string | null
          id: string
          live_url: string | null
          published: boolean
          short_description: string | null
          slug: string
          sort_order: number
          technologies: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          github_url?: string | null
          id?: string
          live_url?: string | null
          published?: boolean
          short_description?: string | null
          slug: string
          sort_order?: number
          technologies?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          github_url?: string | null
          id?: string
          live_url?: string | null
          published?: boolean
          short_description?: string | null
          slug?: string
          sort_order?: number
          technologies?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean
          full_name: string
          id: string
          job_title: string | null
          last_seen_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          full_name: string
          id: string
          job_title?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          full_name?: string
          id?: string
          job_title?: string | null
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_discounts: {
        Row: {
          code: string | null
          created_at: string
          currency: string | null
          discount_amount: number
          fixed_amount: number | null
          id: string
          label: string | null
          percent: number | null
          project_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["discount_source_type"]
        }
        Insert: {
          code?: string | null
          created_at?: string
          currency?: string | null
          discount_amount: number
          fixed_amount?: number | null
          id?: string
          label?: string | null
          percent?: number | null
          project_id: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["discount_source_type"]
        }
        Update: {
          code?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number
          fixed_amount?: number | null
          id?: string
          label?: string | null
          percent?: number | null
          project_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["discount_source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_discounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          bucket_name: string
          category: Database["public"]["Enums"]["file_category"]
          created_at: string
          deleted_at: string | null
          file_size_bytes: number | null
          id: string
          is_public: boolean
          mime_type: string | null
          original_name: string
          project_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          bucket_name: string
          category?: Database["public"]["Enums"]["file_category"]
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          original_name: string
          project_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          bucket_name?: string
          category?: Database["public"]["Enums"]["file_category"]
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          original_name?: string
          project_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          project_id: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          project_id: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          project_id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          is_internal: boolean
          note: string
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note: string
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requests: {
        Row: {
          assigned_to: string | null
          brand_colors: string | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          client_id: string | null
          company_name: string | null
          current_step: number | null
          deadline_date: string | null
          deadline_type: string | null
          description: string | null
          design_style: string | null
          email: string
          figma_url: string | null
          form_snapshot: Json
          full_name: string
          has_brand_colors: boolean | null
          has_design: boolean | null
          has_logo: boolean | null
          id: string
          last_activity_at: string | null
          page_count: number | null
          phone: string | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          project_type: string | null
          reference_urls: string[] | null
          referral_code_entered: string | null
          referral_code_id: string | null
          request_number: string
          required_features: string[] | null
          service_id: string | null
          session_token: string | null
          source: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string
          updated_at: string
          website_status: string | null
        }
        Insert: {
          assigned_to?: string | null
          brand_colors?: string | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          company_name?: string | null
          current_step?: number | null
          deadline_date?: string | null
          deadline_type?: string | null
          description?: string | null
          design_style?: string | null
          email: string
          figma_url?: string | null
          form_snapshot?: Json
          full_name: string
          has_brand_colors?: boolean | null
          has_design?: boolean | null
          has_logo?: boolean | null
          id?: string
          last_activity_at?: string | null
          page_count?: number | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["project_priority"] | null
          project_type?: string | null
          reference_urls?: string[] | null
          referral_code_entered?: string | null
          referral_code_id?: string | null
          request_number: string
          required_features?: string[] | null
          service_id?: string | null
          session_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
          updated_at?: string
          website_status?: string | null
        }
        Update: {
          assigned_to?: string | null
          brand_colors?: string | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          company_name?: string | null
          current_step?: number | null
          deadline_date?: string | null
          deadline_type?: string | null
          description?: string | null
          design_style?: string | null
          email?: string
          figma_url?: string | null
          form_snapshot?: Json
          full_name?: string
          has_brand_colors?: boolean | null
          has_design?: boolean | null
          has_logo?: boolean | null
          id?: string
          last_activity_at?: string | null
          page_count?: number | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["project_priority"] | null
          project_type?: string | null
          reference_urls?: string[] | null
          referral_code_entered?: string | null
          referral_code_id?: string | null
          request_number?: string
          required_features?: string[] | null
          service_id?: string | null
          session_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
          updated_at?: string
          website_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requests_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requirements: {
        Row: {
          constraints: string | null
          content_notes: string | null
          created_at: string
          design_notes: string | null
          features: Json | null
          id: string
          pages: number | null
          project_id: string
          scope: string | null
          summary: string | null
          technical_notes: string | null
          third_party_services: Json | null
          updated_at: string
        }
        Insert: {
          constraints?: string | null
          content_notes?: string | null
          created_at?: string
          design_notes?: string | null
          features?: Json | null
          id?: string
          pages?: number | null
          project_id: string
          scope?: string | null
          summary?: string | null
          technical_notes?: string | null
          third_party_services?: Json | null
          updated_at?: string
        }
        Update: {
          constraints?: string | null
          content_notes?: string | null
          created_at?: string
          design_notes?: string | null
          features?: Json | null
          id?: string
          pages?: number | null
          project_id?: string
          scope?: string | null
          summary?: string | null
          technical_notes?: string | null
          third_party_services?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["project_status"] | null
          id: string
          note: string | null
          project_id: string
          to_status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["project_status"] | null
          id?: string
          note?: string | null
          project_id: string
          to_status: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["project_status"] | null
          id?: string
          note?: string | null
          project_id?: string
          to_status?: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreed_price: number | null
          assigned_to: string | null
          cancelled_at: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          estimated_budget: number | null
          id: string
          priority: Database["public"]["Enums"]["project_priority"]
          project_number: string
          request_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          assigned_to?: string | null
          cancelled_at?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          estimated_budget?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          project_number: string
          request_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          assigned_to?: string | null
          cancelled_at?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          estimated_budget?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          project_number?: string
          request_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          currency: string | null
          discount_total: number
          id: string
          notes: string | null
          project_id: string
          rejected_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          currency?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          project_id: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          currency?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          project_id?: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          owner_id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          owner_id: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          owner_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          available_from: string | null
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_project_id: string | null
          referral_id: string
          referrer_id: string
          reward_percent: number
          reward_type: string
          status: Database["public"]["Enums"]["reward_status"]
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_project_id?: string | null
          referral_id: string
          referrer_id: string
          reward_percent: number
          reward_type?: string
          status?: Database["public"]["Enums"]["reward_status"]
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_project_id?: string | null
          referral_id?: string
          referrer_id?: string
          reward_percent?: number
          reward_type?: string
          status?: Database["public"]["Enums"]["reward_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_redeemed_project_id_fkey"
            columns: ["redeemed_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          minimum_project_amount: number | null
          new_client_discount_percent: number
          referrer_reward_percent: number
          reward_validity_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_project_amount?: number | null
          new_client_discount_percent?: number
          referrer_reward_percent?: number
          reward_validity_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_project_amount?: number | null
          new_client_discount_percent?: number
          referrer_reward_percent?: number
          reward_validity_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          cancelled_at: string | null
          client_discount_percent: number | null
          completed_at: string | null
          created_at: string
          first_project_id: string | null
          id: string
          project_request_id: string | null
          qualified_at: string | null
          referral_code_id: string
          referred_client_id: string | null
          referrer_id: string
          referrer_reward_percent: number | null
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          cancelled_at?: string | null
          client_discount_percent?: number | null
          completed_at?: string | null
          created_at?: string
          first_project_id?: string | null
          id?: string
          project_request_id?: string | null
          qualified_at?: string | null
          referral_code_id: string
          referred_client_id?: string | null
          referrer_id: string
          referrer_reward_percent?: number | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          cancelled_at?: string | null
          client_discount_percent?: number | null
          completed_at?: string | null
          created_at?: string
          first_project_id?: string | null
          id?: string
          project_request_id?: string | null
          qualified_at?: string | null
          referral_code_id?: string
          referred_client_id?: string | null
          referrer_id?: string
          referrer_reward_percent?: number | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_first_project_id_fkey"
            columns: ["first_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_project_request_id_fkey"
            columns: ["project_request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          is_internal: boolean
          note: string
          request_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note: string
          request_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          note?: string
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "project_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string
          id: string
          project_id: string
          published_at: string | null
          rating: number
          review: string
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string
          title: string | null
        }
        Insert: {
          client_id: string
          id?: string
          project_id: string
          published_at?: string | null
          rating: number
          review: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string
          title?: string | null
        }
        Update: {
          client_id?: string
          id?: string
          project_id?: string
          published_at?: string | null
          rating?: number
          review?: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_features: {
        Row: {
          feature: string
          id: string
          service_id: string
          sort_order: number
        }
        Insert: {
          feature: string
          id?: string
          service_id: string
          sort_order?: number
        }
        Update: {
          feature?: string
          id?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_features_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          currency: string | null
          description: string | null
          estimated_days_max: number | null
          estimated_days_min: number | null
          featured: boolean
          id: string
          name: string
          published: boolean
          short_description: string | null
          slug: string
          sort_order: number
          starting_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          featured?: boolean
          id?: string
          name: string
          published?: boolean
          short_description?: string | null
          slug: string
          sort_order?: number
          starting_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          featured?: boolean
          id?: string
          name?: string
          published?: boolean
          short_description?: string | null
          slug?: string
          sort_order?: number
          starting_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_referral_code: { Args: { profile_id: string }; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      generate_request_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      sync_customer_session: { Args: never; Returns: undefined }
    }
    Enums: {
      contact_status: "new" | "read" | "replied" | "archived" | "spam"
      discount_source_type:
        | "referral"
        | "reward"
        | "coupon"
        | "manual"
        | "promotion"
      file_category:
        | "design"
        | "logo"
        | "content"
        | "document"
        | "attachment"
        | "deliverable"
        | "other"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
        | "refunded"
      milestone_status: "pending" | "in_progress" | "completed" | "skipped"
      payment_schedule_status:
        | "upcoming"
        | "due"
        | "invoiced"
        | "paid"
        | "cancelled"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      payment_type: "advance" | "milestone" | "final" | "full" | "refund"
      profile_role: "admin" | "client"
      profile_status: "active" | "suspended" | "deleted"
      project_priority: "low" | "normal" | "high" | "urgent"
      project_status:
        | "pending"
        | "approved"
        | "in_progress"
        | "on_hold"
        | "in_review"
        | "revision"
        | "completed"
        | "cancelled"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      referral_status:
        | "pending"
        | "qualified"
        | "reward_pending"
        | "reward_available"
        | "completed"
        | "cancelled"
        | "invalid"
      request_status:
        | "draft"
        | "new"
        | "reviewing"
        | "quoted"
        | "approved"
        | "rejected"
        | "converted"
        | "cancelled"
      review_status: "pending" | "approved" | "rejected" | "hidden"
      reward_status:
        | "pending"
        | "available"
        | "redeemed"
        | "expired"
        | "cancelled"
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
      contact_status: ["new", "read", "replied", "archived", "spam"],
      discount_source_type: [
        "referral",
        "reward",
        "coupon",
        "manual",
        "promotion",
      ],
      file_category: [
        "design",
        "logo",
        "content",
        "document",
        "attachment",
        "deliverable",
        "other",
      ],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
      ],
      milestone_status: ["pending", "in_progress", "completed", "skipped"],
      payment_schedule_status: [
        "upcoming",
        "due",
        "invoiced",
        "paid",
        "cancelled",
      ],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      payment_type: ["advance", "milestone", "final", "full", "refund"],
      profile_role: ["admin", "client"],
      profile_status: ["active", "suspended", "deleted"],
      project_priority: ["low", "normal", "high", "urgent"],
      project_status: [
        "pending",
        "approved",
        "in_progress",
        "on_hold",
        "in_review",
        "revision",
        "completed",
        "cancelled",
      ],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      referral_status: [
        "pending",
        "qualified",
        "reward_pending",
        "reward_available",
        "completed",
        "cancelled",
        "invalid",
      ],
      request_status: [
        "draft",
        "new",
        "reviewing",
        "quoted",
        "approved",
        "rejected",
        "converted",
        "cancelled",
      ],
      review_status: ["pending", "approved", "rejected", "hidden"],
      reward_status: [
        "pending",
        "available",
        "redeemed",
        "expired",
        "cancelled",
      ],
    },
  },
} as const

