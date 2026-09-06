import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isReferralSortField,
  isReferralStatus,
  QUALIFIED_REFERRAL_STATUSES,
  REFERRAL_LIST_PAGE_SIZE,
  type AdminReferralListItem,
  type AdminReferralRewardItem,
  type AdminReferralDetail,
  type ReferralListFilters,
  type ReferralOverviewResult,
  type ReferralPersonRef,
  type QueryResult,
} from "@/lib/admin-referral-constants";
import type {
  ReferralCodeRow,
  ReferralRewardRow,
  ReferralRow,
  ReferralSettingsRow,
  ReferralStatus,
} from "@/types/database";

export * from "@/lib/admin-referral-constants";
export { toReferralProgramSettings } from "@/lib/referral-rules";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    error.code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship") ||
    message.includes("could not find the function")
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

function toPersonRef(
  row: Pick<
    ReferralPersonRef,
    "id" | "full_name" | "display_name" | "company_name" | "avatar_url"
  > | null,
): ReferralPersonRef | null {
  return row
    ? {
        id: row.id,
        full_name: row.full_name,
        display_name: row.display_name,
        company_name: row.company_name,
        avatar_url: row.avatar_url,
      }
    : null;
}

async function enrichReferralRows(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  rows: ReferralRow[],
): Promise<AdminReferralListItem[]> {
  const referrerIds = [...new Set(rows.map((row) => row.referrer_id))];
  const referredIds = [
    ...new Set(
      rows
        .map((row) => row.referred_client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const codeIds = [...new Set(rows.map((row) => row.referral_code_id))];
  const requestIds = [
    ...new Set(
      rows
        .map((row) => row.project_request_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const projectIds = [
    ...new Set(
      rows
        .map((row) => row.first_project_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const allProfileIds = [...new Set([...referrerIds, ...referredIds])];
  const profiles = new Map<string, ReferralPersonRef>();
  if (allProfileIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .in("id", allProfileIds);
    for (const profile of data ?? []) {
      const ref = toPersonRef(profile);
      if (ref) {
        profiles.set(profile.id, ref);
      }
    }
  }

  const codes = new Map<string, string>();
  if (codeIds.length > 0) {
    const { data } = await supabase
      .from("referral_codes")
      .select("id, code")
      .in("id", codeIds);
    for (const code of (data ?? []) as Pick<ReferralCodeRow, "id" | "code">[]) {
      codes.set(code.id, code.code);
    }
  }

  const requests = new Map<string, string>();
  if (requestIds.length > 0) {
    const { data } = await supabase
      .from("project_requests")
      .select("id, request_number")
      .in("id", requestIds);
    for (const row of (data ?? []) as Array<{ id: string; request_number: string }>) {
      requests.set(row.id, row.request_number);
    }
  }

  const projects = new Map<string, { project_number: string; title: string }>();
  if (projectIds.length > 0) {
    const { data } = await supabase
      .from("projects")
      .select("id, project_number, title")
      .in("id", projectIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      project_number: string;
      title: string;
    }>) {
      projects.set(row.id, {
        project_number: row.project_number,
        title: row.title,
      });
    }
  }

  return rows.map((row) => {
    const project = row.first_project_id ? projects.get(row.first_project_id) : undefined;
    return {
      ...row,
      status: row.status as ReferralStatus,
      client_discount_percent: row.client_discount_percent ?? 0,
      referrer_reward_percent: row.referrer_reward_percent ?? 0,
      referrer: profiles.get(row.referrer_id) ?? null,
      referredClient: row.referred_client_id
        ? profiles.get(row.referred_client_id) ?? null
        : null,
      code: codes.get(row.referral_code_id) ?? null,
      requestNumber: row.project_request_id
        ? requests.get(row.project_request_id) ?? null
        : null,
      projectNumber: project?.project_number ?? null,
      projectTitle: project?.title ?? null,
    };
  });
}

/** Overview counters for the referral program (each group degrades independently). */
export async function getReferralOverview(): Promise<ReferralOverviewResult> {
  const supabase = await createServerSupabaseClient();

  const [codesAll, codesActive, referralsAll, referralsQualified, rewardsPending, rewardsAvailable, rewardsRedeemed] =
    await Promise.all([
      supabase
        .from("referral_codes")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("referral_codes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("referrals").select("id", { count: "exact", head: true }),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .in("status", QUALIFIED_REFERRAL_STATUSES),
      supabase
        .from("referral_rewards")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("referral_rewards")
        .select("id", { count: "exact", head: true })
        .eq("status", "available"),
      supabase
        .from("referral_rewards")
        .select("id", { count: "exact", head: true })
        .eq("status", "redeemed"),
    ]);

  const codes =
    codesAll.error || codesActive.error
      ? toQueryResult({ total: 0, active: 0 }, codesAll.error ?? codesActive.error, "referral_codes", true)
      : {
          status: "ok" as const,
          data: {
            total: codesAll.count ?? 0,
            active: codesActive.count ?? 0,
          },
        };

  const referrals =
    referralsAll.error || referralsQualified.error
      ? toQueryResult({ total: 0, qualified: 0 }, referralsAll.error ?? referralsQualified.error, "referrals", true)
      : {
          status: "ok" as const,
          data: {
            total: referralsAll.count ?? 0,
            qualified: referralsQualified.count ?? 0,
          },
        };

  const rewards =
    rewardsPending.error || rewardsAvailable.error || rewardsRedeemed.error
      ? toQueryResult(
          { pending: 0, available: 0, redeemed: 0 },
          rewardsPending.error ?? rewardsAvailable.error ?? rewardsRedeemed.error,
          "referral_rewards",
          true,
        )
      : {
          status: "ok" as const,
          data: {
            pending: rewardsPending.count ?? 0,
            available: rewardsAvailable.count ?? 0,
            redeemed: rewardsRedeemed.count ?? 0,
          },
        };

  return { codes, referrals, rewards };
}

/** List referrals with search (referrer, referred client, code) + status filter. */
export async function getAdminReferrals(
  filters: ReferralListFilters,
): Promise<QueryResult<{ items: AdminReferralListItem[]; total: number; page: number; totalPages: number }>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim();
  const status = filters.status && isReferralStatus(filters.status) ? filters.status : null;
  const sort = filters.sort && isReferralSortField(filters.sort) ? filters.sort : "created_at";
  const ascending = filters.dir === "asc";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  const escapedSearch = search.replace(/[%_,()]/g, " ").trim();
  let profileIds: string[] | null = null;
  let codeIds: string[] | null = null;

  if (escapedSearch) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .or(
        `full_name.ilike.%${escapedSearch}%,display_name.ilike.%${escapedSearch}%,company_name.ilike.%${escapedSearch}%`,
      );
    profileIds = (profiles ?? []).map((row) => row.id);

    const { data: codes } = await supabase
      .from("referral_codes")
      .select("id")
      .ilike("code", `%${escapedSearch}%`);
    codeIds = (codes ?? []).map((row) => row.id);
  }

  // Searchable entity list: referrer, referred client, or code.
  const orFilters: string[] = [];
  if (escapedSearch) {
    if (profileIds && profileIds.length > 0) {
      orFilters.push(`referrer_id.in.(${profileIds.join(",")})`);
      orFilters.push(`referred_client_id.in.(${profileIds.join(",")})`);
    }
    if (codeIds && codeIds.length > 0) {
      orFilters.push(`referral_code_id.in.(${codeIds.join(",")})`);
    }
    if (orFilters.length === 0) {
      return {
        status: "empty",
        data: { items: [], total: 0, page: 1, totalPages: 1 },
      };
    }
  }

  let countQuery = supabase
    .from("referrals")
    .select("id", { count: "exact", head: true });

  if (status) {
    countQuery = countQuery.eq("status", status);
  }
  if (orFilters.length > 0) {
    countQuery = countQuery.or(orFilters.join(","));
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    return toQueryResult(
      { items: [], total: 0, page: 1, totalPages: 1 },
      countError,
      "referrals",
      true,
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / REFERRAL_LIST_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * REFERRAL_LIST_PAGE_SIZE;
  const to = from + REFERRAL_LIST_PAGE_SIZE - 1;

  let dataQuery = supabase
    .from("referrals")
    .select("*")
    .order(sort, { ascending, nullsFirst: false });

  if (status) {
    dataQuery = dataQuery.eq("status", status);
  }
  if (orFilters.length > 0) {
    dataQuery = dataQuery.or(orFilters.join(","));
  }
  dataQuery = dataQuery.range(from, to);

  const { data, error } = await dataQuery;
  if (error) {
    return toQueryResult(
      { items: [], total: 0, page: 1, totalPages: 1 },
      error,
      "referrals",
      true,
    );
  }

  const rows = (data ?? []) as ReferralRow[];
  const items = await enrichReferralRows(supabase, rows);

  return {
    status: items.length === 0 && total === 0 ? "empty" : "ok",
    data: { items, total, page, totalPages },
  };
}

/** Full referral relationship + reward history for one referral. */
export async function getAdminReferral(
  id: string,
): Promise<QueryResult<AdminReferralDetail | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(null as unknown as AdminReferralDetail, error, "referrals", true);
  }

  const row = data as ReferralRow | null;
  if (!row) {
    return { status: "empty", data: null };
  }

  const [enriched] = await enrichReferralRows(supabase, [row]);

  const { data: rewardRows, error: rewardsError } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referral_id", id)
    .order("created_at", { ascending: false });

  let rewards: QueryResult<AdminReferralRewardItem[]>;
  if (rewardsError) {
    rewards = toQueryResult([], rewardsError, "referral_rewards", true);
  } else {
    const rowsList = (rewardRows ?? []) as ReferralRewardRow[];
    const projectIds = [
      ...new Set(
        rowsList
          .map((reward) => reward.redeemed_project_id)
          .filter((pid): pid is string => Boolean(pid)),
      ),
    ];
    const projectNumbers = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, project_number")
        .in("id", projectIds);
      for (const project of (projects ?? []) as Array<{ id: string; project_number: string }>) {
        projectNumbers.set(project.id, project.project_number);
      }
    }
    const items: AdminReferralRewardItem[] = rowsList.map((reward) => ({
      ...reward,
      redeemedProjectNumber: reward.redeemed_project_id
        ? projectNumbers.get(reward.redeemed_project_id) ?? null
        : null,
    }));
    rewards = toQueryResult(items, null, "referral_rewards", items.length === 0);
  }

  return {
    status: "ok",
    data: { ...enriched, rewards },
  };
}

/** Program settings row (null when the table exists but has no row yet). */
export async function getReferralSettings(): Promise<QueryResult<ReferralSettingsRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("referral_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return toQueryResult(null as unknown as ReferralSettingsRow, error, "referral_settings", true);
  }

  return { status: "ok", data: (data as ReferralSettingsRow | null) ?? null };
}
