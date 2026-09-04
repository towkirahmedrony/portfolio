import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type ContentListFilters,
  type PortfolioProjectWithImages,
  type QueryResult,
  type ServiceWithFeatures,
} from "@/lib/admin-content-constants";
import type {
  PortfolioProjectImageRow,
  PortfolioProjectRow,
  ServiceFeatureRow,
  ServiceRow,
} from "@/types/database";

export * from "@/lib/admin-content-constants";

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

/** Portfolio projects sorted for the admin list (sort order, then newest). */
export async function getAdminPortfolioProjects(
  filters: ContentListFilters,
): Promise<QueryResult<PortfolioProjectRow[]>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim().replace(/[%_,()]/g, " ").trim();

  let query = supabase
    .from("portfolio_projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters.published === "true") query = query.eq("published", true);
  if (filters.published === "false") query = query.eq("published", false);
  if (filters.featured === "true") query = query.eq("featured", true);
  if (filters.featured === "false") query = query.eq("featured", false);
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,slug.ilike.%${search}%,category.ilike.%${search}%,short_description.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  const rows = (data ?? []) as PortfolioProjectRow[];
  return toQueryResult(rows, error, "portfolio_projects", rows.length === 0);
}

/** One portfolio project + its gallery images (ordered). */
export async function getAdminPortfolioProject(
  id: string,
): Promise<QueryResult<PortfolioProjectWithImages | null>> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(
      null as unknown as PortfolioProjectWithImages,
      error,
      "portfolio_projects",
      true,
    );
  }

  const project = data as PortfolioProjectRow | null;
  if (!project) {
    return { status: "empty", data: null };
  }

  const { data: imageData, error: imagesError } = await supabase
    .from("portfolio_project_images")
    .select("*")
    .eq("portfolio_project_id", id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (imagesError) {
    return toQueryResult(
      null as unknown as PortfolioProjectWithImages,
      imagesError,
      "portfolio_project_images",
      true,
    );
  }

  return {
    status: "ok",
    data: {
      ...project,
      images: (imageData ?? []) as PortfolioProjectImageRow[],
    },
  };
}

/** Services sorted for the admin list (sort order, then newest). */
export async function getAdminServices(
  filters: ContentListFilters,
): Promise<QueryResult<ServiceRow[]>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim().replace(/[%_,()]/g, " ").trim();

  let query = supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters.published === "true") query = query.eq("published", true);
  if (filters.published === "false") query = query.eq("published", false);
  if (filters.featured === "true") query = query.eq("featured", true);
  if (filters.featured === "false") query = query.eq("featured", false);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,slug.ilike.%${search}%,short_description.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  const rows = (data ?? []) as ServiceRow[];
  return toQueryResult(rows, error, "services", rows.length === 0);
}

/** One service + its feature bullets (ordered). */
export async function getAdminService(
  id: string,
): Promise<QueryResult<ServiceWithFeatures | null>> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(null as unknown as ServiceWithFeatures, error, "services", true);
  }

  const service = data as ServiceRow | null;
  if (!service) {
    return { status: "empty", data: null };
  }

  const { data: featureData, error: featuresError } = await supabase
    .from("service_features")
    .select("*")
    .eq("service_id", id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (featuresError) {
    return toQueryResult(
      null as unknown as ServiceWithFeatures,
      featuresError,
      "service_features",
      true,
    );
  }

  return {
    status: "ok",
    data: {
      ...service,
      features: (featureData ?? []) as ServiceFeatureRow[],
    },
  };
}
