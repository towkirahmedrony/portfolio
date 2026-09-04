import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Project, Service } from "@/types";
import type {
  PortfolioProjectRow,
  ServiceFeatureRow,
  ServiceRow,
} from "@/types/database";

/**
 * Public (server-side) data access for portfolio & services content.
 *
 * Everything here only ever reads *published* rows, ordered by sort_order —
 * the same portfolio_projects / services records the admin CMS manages. RLS
 * additionally restricts anonymous reads to published rows (see
 * supabase/migrations/20260904210000_public_content_read_policies.sql).
 *
 * Result states are intentionally coarse: public pages never surface raw
 * database error messages.
 */
export type PublicContentResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error" };

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
    message.includes("could not find a relationship") ||
    message.includes("permission denied")
  );
}

function toResult<T>(
  data: T,
  error: { message?: string; code?: string } | null,
  isEmpty: boolean,
): PublicContentResult<T> {
  if (error) {
    // A missing/unrelated error can mean the migration has not been applied —
    // same "unavailable" treatment as the admin content queries.
    return isMissingRelation(error)
      ? { status: "unavailable" }
      : { status: "error" };
  }

  return isEmpty ? { status: "empty" } : { status: "ok", data };
}

function toPublicProject(row: PortfolioProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || row.short_description || "",
    category: row.category || null,
    image: row.thumbnail_url,
    technologies: row.technologies ?? [],
    liveUrl: row.live_url,
    githubUrl: row.github_url,
    featured: row.featured,
  };
}

/** Max published projects shown on the homepage selected-work section. */
export const HOME_PROJECTS_LIMIT = 6;

export type PublicProjectQuery = {
  /**
   * Optional cap for list views such as the homepage.
   * Omit to return every published project (ordered by sort_order).
   */
  limit?: number;
};

export async function getPublicProjects(
  query: PublicProjectQuery = {},
): Promise<PublicContentResult<Project[]>> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  try {
    const supabase = createPublicSupabaseClient();

    let builder = supabase
      .from("portfolio_projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (typeof query.limit === "number") {
      builder = builder.limit(query.limit);
    }

    const { data, error } = await builder;
    const rows = (data ?? []) as PortfolioProjectRow[];
    return toResult(rows.map(toPublicProject), error, rows.length === 0);
  } catch {
    return { status: "unavailable" };
  }
}

function toPublicService(
  row: ServiceRow,
  features: string[] = [],
): Service {
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    shortDescription: row.short_description,
    description: row.description,
    startingPrice:
      row.starting_price == null ? null : Number(row.starting_price),
    currency: row.currency || "BDT",
    estimatedDaysMin: row.estimated_days_min,
    estimatedDaysMax: row.estimated_days_max,
    features,
    featured: row.featured,
  };
}

export async function getPublicServices(): Promise<PublicContentResult<Service[]>> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  try {
    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    const serviceRows = (data ?? []) as ServiceRow[];
    if (error || serviceRows.length === 0) {
      return toResult([] as Service[], error, serviceRows.length === 0);
    }

    const serviceIds = serviceRows.map((row) => row.id);
    const { data: featureData } = await supabase
      .from("service_features")
      .select("service_id, feature, sort_order, id")
      .in("service_id", serviceIds)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    const featuresByService = new Map<string, string[]>();
    for (const feature of (featureData ?? []) as ServiceFeatureRow[]) {
      const list = featuresByService.get(feature.service_id) ?? [];
      list.push(feature.feature);
      featuresByService.set(feature.service_id, list);
    }

    const services: Service[] = serviceRows.map((row: ServiceRow) =>
      toPublicService(row, featuresByService.get(row.id) ?? []),
    );

    return { status: "ok", data: services };
  } catch {
    return { status: "unavailable" };
  }
}
