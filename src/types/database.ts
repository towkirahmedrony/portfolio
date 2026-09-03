export type ProfileRole = "admin" | "client";
export type ProfileStatus = "active" | "suspended" | "deleted";

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
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name: string;
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
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: ProfileRole;
      profile_status: ProfileStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
