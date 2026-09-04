import type { DashboardQueryState } from "@/lib/admin-dashboard";

export function QueryNotice({
  state,
}: {
  state: Extract<DashboardQueryState<unknown>, { status: "error" | "unavailable" }>;
}) {
  return (
    <p className="mt-2 text-sm leading-relaxed text-muted">
      {state.status === "unavailable" ? "Schema limitation. " : "Could not load this data. "}
      {state.message}
    </p>
  );
}

export function EmptyNotice({ children }: { children: string }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>;
}
