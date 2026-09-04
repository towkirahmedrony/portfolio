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

export type RewardStatus =
  | "pending"
  | "available"
  | "redeemed"
  | "expired"
  | "cancelled";

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
  priority: string;
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
  payment_type: string;
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
        ];
      };
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
    };
    Enums: {
      profile_role: ProfileRole;
      profile_status: ProfileStatus;
      project_status: ProjectStatus;
      request_status: RequestStatus;
      quote_status: QuoteStatus;
      invoice_status: InvoiceStatus;
      payment_status: PaymentStatus;
      reward_status: RewardStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
