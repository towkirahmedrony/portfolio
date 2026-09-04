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
    };
    CompositeTypes: Record<string, never>;
  };
};
