export type ProfileRole = "admin" | "client";
export type ProfileStatus = "active" | "suspended" | "deleted";

export type ProjectStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "in_review"
  | "revision"
  | "completed"
  | "cancelled";

export type RequestStatus =
  | "new"
  | "reviewing"
  | "quoted"
  | "approved"
  | "rejected"
  | "converted"
  | "cancelled";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "skipped";

export type FileCategory =
  | "design"
  | "logo"
  | "content"
  | "document"
  | "attachment"
  | "deliverable"
  | "other";

export type DiscountSourceType =
  | "referral"
  | "reward"
  | "coupon"
  | "manual"
  | "promotion";

export type PaymentType = "advance" | "milestone" | "final" | "full" | "refund";

export type RewardStatus =
  | "pending"
  | "available"
  | "redeemed"
  | "expired"
  | "cancelled";

export type ReferralStatus =
  | "pending"
  | "qualified"
  | "reward_pending"
  | "reward_available"
  | "completed"
  | "cancelled"
  | "invalid";

export type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_client_id: string | null;
  referral_code_id: string;
  project_request_id: string | null;
  first_project_id: string | null;
  status: ReferralStatus;
  client_discount_percent: number;
  referrer_reward_percent: number;
  created_at: string;
  qualified_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type ReferralSettingsRow = {
  id: string;
  new_client_discount_percent: number;
  referrer_reward_percent: number;
  minimum_project_amount: number | null;
  reward_validity_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PortfolioProjectRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  technologies: string[];
  live_url: string | null;
  github_url: string | null;
  thumbnail_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioProjectImageRow = {
  id: string;
  portfolio_project_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
};

export type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  starting_price: number | null;
  currency: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ServiceFeatureRow = {
  id: string;
  service_id: string;
  feature: string;
  sort_order: number;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderFormStepRow = {
  id: string;
  step_key: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderFormFieldRow = {
  id: string;
  field_key: string;
  step_id: string;
  input_type: string;
  label: string;
  hint: string | null;
  placeholder: string | null;
  options_group: string | null;
  required: boolean;
  visible: boolean;
  sort_order: number;
  conditional: Json;
  constraints: Json;
  default_value: Json | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderFormOptionRow = {
  id: string;
  group: string;
  slug: string;
  label: string;
  description: string | null;
  requires_text: boolean;
  sort_order: number;
  is_active: boolean;
  meta: Json;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferenceRow = {
  id: string;
  user_id: string;
  email_project_updates: boolean;
  email_messages: boolean;
  email_quotes: boolean;
  email_payments: boolean;
  email_referrals: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactStatus = "new" | "read" | "replied" | "archived" | "spam";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  created_at: string;
  read_at: string | null;
  replied_at: string | null;
};

export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";

export type ReviewRow = {
  id: string;
  project_id: string;
  client_id: string;
  rating: number;
  title: string | null;
  review: string;
  status: ReviewStatus;
  submitted_at: string;
  published_at: string | null;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

export type ProfileUpdate = {
  full_name?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  role?: ProfileRole;
  status?: ProfileStatus;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  last_seen_at?: string | null;
};

export type ReferralCodeRow = {
  id: string;
  owner_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  used_count: number;
};

export type ProjectRow = {
  id: string;
  project_number: string;
  request_id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  currency: string;
  estimated_budget: number | null;
  agreed_price: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRequestRow = {
  id: string;
  request_number: string;
  client_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  project_type: string | null;
  website_status: string | null;
  page_count: number | null;
  description: string | null;
  required_features: string[] | null;
  has_design: boolean | null;
  figma_url: string | null;
  reference_urls: string[] | null;
  design_style: string | null;
  has_logo: boolean | null;
  has_brand_colors: boolean | null;
  brand_colors: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  deadline_type: string | null;
  deadline_date: string | null;
  referral_code_entered: string | null;
  referral_code_id: string | null;
  source: string | null;
  status: RequestStatus;
  service_id: string | null;
  form_snapshot: Json;
  submitted_at: string;
  updated_at: string;
};

export type ProjectRequestInsert = {
  request_number?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  project_type?: string | null;
  website_status?: string | null;
  page_count?: number | null;
  description?: string | null;
  required_features?: string[] | null;
  has_design?: boolean | null;
  figma_url?: string | null;
  reference_urls?: string[] | null;
  design_style?: string | null;
  has_logo?: boolean | null;
  has_brand_colors?: boolean | null;
  brand_colors?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_currency?: string | null;
  deadline_type?: string | null;
  deadline_date?: string | null;
  referral_code_entered?: string | null;
  source?: string | null;
  service_id?: string | null;
  form_snapshot?: Json;
};

export type QuoteRow = {
  id: string;
  project_id: string;
  version: number;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  status: QuoteStatus;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  project_id: string;
  client_id: string;
  quote_id: string | null;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  invoice_id: string;
  project_id: string;
  client_id: string;
  amount: number;
  currency: string;
  payment_type: PaymentType;
  payment_method: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  status: PaymentStatus;
  transaction_reference: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentEventRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown> | unknown;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type ProjectMessageRow = {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  reply_to_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRequirementRow = {
  id: string;
  project_id: string;
  summary: string | null;
  scope: string | null;
  pages: number | null;
  features: unknown;
  design_notes: string | null;
  technical_notes: string | null;
  content_notes: string | null;
  third_party_services: unknown;
  constraints: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatusHistoryRow = {
  id: string;
  project_id: string;
  from_status: ProjectStatus | null;
  to_status: ProjectStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export type ProjectDiscountRow = {
  id: string;
  project_id: string;
  source_type: DiscountSourceType;
  source_id: string | null;
  code: string | null;
  label: string | null;
  percent: number | null;
  fixed_amount: number | null;
  discount_amount: number;
  currency: string;
  created_at: string;
};

export type ProjectMilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  sort_order: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectNoteRow = {
  id: string;
  project_id: string;
  author_id: string;
  note: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectFileRow = {
  id: string;
  project_id: string;
  uploaded_by: string;
  bucket_name: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  category: FileCategory;
  is_public: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
};

export type ReferralRewardRow = {
  id: string;
  referral_id: string;
  referrer_id: string;
  reward_type: string;
  reward_percent: number;
  status: RewardStatus;
  available_from: string | null;
  expires_at: string | null;
  redeemed_project_id: string | null;
  redeemed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type ForeignKey = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<Row, Relationships extends ForeignKey[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileRow;
        Update: ProfileUpdate;
        Relationships: [];
      };
      referral_codes: {
        Row: ReferralCodeRow;
        Insert: Partial<ReferralCodeRow>;
        Update: Partial<ReferralCodeRow>;
        Relationships: [
          {
            foreignKeyName: "referral_codes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: ProjectRow;
        Insert: Partial<ProjectRow>;
        Update: Partial<ProjectRow>;
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      project_requests: {
        Row: ProjectRequestRow;
        Insert: ProjectRequestInsert;
        Update: Partial<ProjectRequestRow>;
        Relationships: [
          {
            foreignKeyName: "project_requests_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_requests_referral_code_id_fkey";
            columns: ["referral_code_id"];
            isOneToOne: false;
            referencedRelation: "referral_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      order_form_steps: TableDef<OrderFormStepRow>;
      order_form_fields: TableDef<
        OrderFormFieldRow,
        [
          {
            foreignKeyName: "order_form_fields_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "order_form_steps";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_form_options: TableDef<OrderFormOptionRow>;
      quotes: TableDef<
        QuoteRow,
        [
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      invoices: TableDef<
        InvoiceRow,
        [
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ]
      >;
      payments: TableDef<
        PaymentRow,
        [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_messages: TableDef<
        ProjectMessageRow,
        [
          {
            foreignKeyName: "project_messages_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_requirements: TableDef<
        ProjectRequirementRow,
        [
          {
            foreignKeyName: "project_requirements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_status_history: TableDef<
        ProjectStatusHistoryRow,
        [
          {
            foreignKeyName: "project_status_history_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_milestones: TableDef<
        ProjectMilestoneRow,
        [
          {
            foreignKeyName: "project_milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_notes: TableDef<
        ProjectNoteRow,
        [
          {
            foreignKeyName: "project_notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_files: TableDef<
        ProjectFileRow,
        [
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      project_discounts: TableDef<
        ProjectDiscountRow,
        [
          {
            foreignKeyName: "project_discounts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      quote_items: TableDef<
        QuoteItemRow,
        [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ]
      >;
      invoice_items: TableDef<
        InvoiceItemRow,
        [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ]
      >;
      payment_events: TableDef<PaymentEventRow>;
      referral_rewards: TableDef<
        ReferralRewardRow,
        [
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      referrals: TableDef<
        ReferralRow,
        [
          {
            foreignKeyName: "referrals_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referred_client_id_fkey";
            columns: ["referred_client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referral_code_id_fkey";
            columns: ["referral_code_id"];
            isOneToOne: false;
            referencedRelation: "referral_codes";
            referencedColumns: ["id"];
          },
        ]
      >;
      referral_settings: TableDef<ReferralSettingsRow>;
      portfolio_projects: TableDef<
        PortfolioProjectRow,
        [
          {
            foreignKeyName: "portfolio_projects_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "portfolio_project_images";
            referencedColumns: ["portfolio_project_id"];
          },
        ]
      >;
      portfolio_project_images: TableDef<PortfolioProjectImageRow>;
      services: TableDef<
        ServiceRow,
        [
          {
            foreignKeyName: "services_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "service_features";
            referencedColumns: ["service_id"];
          },
        ]
      >;
      service_features: TableDef<ServiceFeatureRow>;
      contact_messages: TableDef<ContactMessageRow>;
      notification_preferences: TableDef<
        NotificationPreferenceRow,
        [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      reviews: TableDef<
        ReviewRow,
        [
          {
            foreignKeyName: "reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ]
      >;
      audit_logs: TableDef<
        AuditLogRow,
        [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      sync_customer_session: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      is_active_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_create_invoice_from_quote: {
        Args: { p_quote_id: string; p_due_date?: string | null };
        Returns: string;
      };
      admin_record_manual_payment: {
        Args: {
          p_invoice_id: string;
          p_amount: number;
          p_payment_type: string;
          p_payment_method?: string | null;
          p_provider?: string | null;
          p_transaction_reference?: string | null;
          p_paid_at?: string | null;
        };
        Returns: string;
      };
      admin_auth_emails: {
        Args: { p_ids: string[] };
        Returns: Array<{ profile_id: string; email: string }>;
      };
      admin_set_client_status: {
        Args: { p_client_id: string; p_status: string };
        Returns: undefined;
      };
      admin_set_client_email_verified: {
        Args: { p_client_id: string; p_email_verified: boolean };
        Returns: undefined;
      };
      admin_update_referral_settings: {
        Args: {
          p_client_discount_percent: number;
          p_referrer_reward_percent: number;
          p_minimum_project_amount?: number | null;
          p_reward_validity_days?: number | null;
          p_is_active?: boolean;
        };
        Returns: undefined;
      };
      admin_convert_project_request: {
        Args: { p_request_id: string };
        Returns: string;
      };
    };
    Enums: {
      profile_role: ProfileRole;
      profile_status: ProfileStatus;
      project_status: ProjectStatus;
      project_priority: ProjectPriority;
      request_status: RequestStatus;
      quote_status: QuoteStatus;
      invoice_status: InvoiceStatus;
      payment_status: PaymentStatus;
      reward_status: RewardStatus;
      referral_status: ReferralStatus;
      review_status: ReviewStatus;
      contact_status: ContactStatus;
      milestone_status: MilestoneStatus;
      file_category: FileCategory;
      discount_source_type: DiscountSourceType;
      payment_type: PaymentType;
    };
    CompositeTypes: Record<string, never>;
  };
};
