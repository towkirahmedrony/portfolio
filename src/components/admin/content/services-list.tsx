import Link from "next/link";
import type { ServiceRow } from "@/types/database";
import { formatMoney } from "@/lib/admin-dashboard";
import { formatDate } from "@/lib/admin-content-constants";
import {
  deleteService,
  reorderService,
  setServiceFlag,
} from "@/lib/admin-content-actions";
import { DeleteActionForm, FlagToggle, ReorderForm } from "@/components/admin/content/content-common";

function formatDuration(service: ServiceRow): string {
  if (service.estimated_days_min == null && service.estimated_days_max == null) {
    return "—";
  }
  if (service.estimated_days_min != null && service.estimated_days_max != null) {
    return service.estimated_days_min === service.estimated_days_max
      ? `${service.estimated_days_min} days`
      : `${service.estimated_days_min}–${service.estimated_days_max} days`;
  }
  return `${service.estimated_days_min ?? service.estimated_days_max} days`;
}

export function ServicesTable({ services }: { services: ServiceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[62rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Est. duration</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {services.map((service, index) => (
            <tr
              key={service.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/services/${service.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {service.name}
                </Link>
                <div className="font-mono text-xs text-muted">{service.slug}</div>
              </td>
              <td className="px-4 py-3 text-foreground">
                {service.starting_price != null
                  ? `From ${formatMoney(Number(service.starting_price), service.currency || "BDT")}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted">{formatDuration(service)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <FlagToggle
                    action={setServiceFlag}
                    hidden={{ serviceId: service.id, flag: "published" }}
                    active={service.published}
                    activeLabel="Published"
                    inactiveLabel="Draft"
                    activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    inactiveClass="border-card-border bg-background text-muted"
                  />
                  <FlagToggle
                    action={setServiceFlag}
                    hidden={{ serviceId: service.id, flag: "featured" }}
                    active={service.featured}
                    activeLabel="Featured"
                    inactiveLabel="Not featured"
                    activeClass="border-transparent bg-accent-soft text-accent"
                    inactiveClass="border-card-border bg-background text-muted"
                  />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{service.sort_order}</span>
                  <ReorderForm
                    action={reorderService}
                    hidden={{ serviceId: service.id }}
                    direction="up"
                    disabled={index === 0}
                    label={`Move ${service.name} up`}
                  />
                  <ReorderForm
                    action={reorderService}
                    hidden={{ serviceId: service.id }}
                    direction="down"
                    disabled={index === services.length - 1}
                    label={`Move ${service.name} down`}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(service.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/services/${service.id}`}
                    className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteActionForm
                    action={deleteService}
                    hidden={{ serviceId: service.id }}
                    confirmMessage={`Delete "${service.name}"? Its feature bullets are removed too.`}
                    label="Delete"
                    successMessage="Service deleted."
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
