import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isContactStatus,
  type ContactFilters,
  type ContactMessageRow,
  type QueryResult,
} from "@/lib/admin-contact-constants";

export * from "@/lib/admin-contact-constants";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship")
  );
}

function toQueryResult<T>(
  data: T,
  error: { message?: string; code?: string } | null,
  table: string,
  isEmpty: boolean,
): QueryResult<T> {
  if (error) {
    if (isMissingRelation(error)) {
      return {
        status: "unavailable",
        message: `${table} is not available in the current database schema.`,
      };
    }
    return { status: "error", message: error.message ?? "Unknown error" };
  }

  return isEmpty ? { status: "empty", data } : { status: "ok", data };
}

/** Inbox messages (newest first) with optional search + status filter. */
export async function getContactMessages(
  filters: ContactFilters,
): Promise<QueryResult<ContactMessageRow[]>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim().replace(/[%_,()]/g, " ").trim();
  const status = filters.status && isContactStatus(filters.status) ? filters.status : null;

  let query = supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  const rows = (data ?? []) as ContactMessageRow[];
  return toQueryResult(rows, error, "contact_messages", rows.length === 0);
}
