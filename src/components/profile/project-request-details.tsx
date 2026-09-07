import Link from "next/link";
import { CancelRequestButton } from "@/components/profile/cancel-request-button";
import { FileDownloader } from "@/components/profile/file-downloader";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes, formatDate, formatDateTime, formatStatusLabel, getStatusStyle } from "@/lib/admin-project-constants";
import {
  displaySlug,
  formatClientRequestStatusLabel,
  formatRequestBudget,
  formatRequestDeadline,
  formatYesNo,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import type { CustomerProjectRequestDetail } from "@/lib/customer-project-requests";
import { formatMoney } from "@/lib/quote-money";
import type { Json } from "@/types/database";

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">
        {value == null || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function snapshotCustomFields(snapshot: Json | null | undefined) {
  const root = asRecord(snapshot);
  if (!root) {
    return [] as Array<{ label: string; value: string }>;
  }

  const steps = Array.isArray(root.steps) ? root.steps : [];
  const known = new Set([
    "full_name",
    "fullName",
    "email",
    "phone",
    "company_name",
    "company",
    "project_type",
    "projectType",
    "website_status",
    "websiteStatus",
    "page_count",
    "pageCount",
    "description",
    "required_features",
    "features",
    "has_design",
    "hasDesign",
    "figma_url",
    "figmaUrl",
    "reference_urls",
    "referenceUrls",
    "design_style",
    "designStyle",
    "has_logo",
    "hasLogo",
    "has_brand_colors",
    "hasBrandColors",
    "brand_colors",
    "brandColors",
    "budget",
    "budget_range",
    "budgetRange",
    "deadline_type",
    "deadline",
    "deadline_date",
    "specific_date",
    "specificDate",
    "referral_code_entered",
    "referral_code",
    "referralCode",
  ]);

  const items: Array<{ label: string; value: string }> = [];

  for (const step of steps) {
    const stepRecord = asRecord(step);
    const fields = Array.isArray(stepRecord?.fields) ? stepRecord.fields : [];
    for (const field of fields) {
      const record = asRecord(field);
      if (!record) {
        continue;
      }
      const key = typeof record.field_key === "string" ? record.field_key : "";
      if (!key || known.has(key) || record.visible === false) {
        continue;
      }
      const label = typeof record.label === "string" ? record.label : key;
      const other = typeof record.other_value === "string" ? record.other_value.trim() : "";
      const raw = record.value;
      let value = "—";
      if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
        value = raw.length > 0 ? raw.join(", ") : "None selected";
      } else if (typeof raw === "string" && raw.trim()) {
        value = raw;
      }
      if (other) {
        value = other;
      }
      if (value === "—" || value === "" || value === "None selected") {
        continue;
      }
      items.push({ label, value });
    }
  }

  return items;
}

export function ProjectRequestDetails({
  detail,
}: {
  detail: CustomerProjectRequestDetail;
}) {
  const { request, linkedProject, quote, canCancel, canEdit, canResubmit, serviceName, files } = detail;
  const features = (request.required_features as string[] | null) ?? [];
  const references = (request.reference_urls as string[] | null) ?? [];
  const customFields = snapshotCustomFields(request.form_snapshot);
  const lastUpdated = request.updated_at || request.last_activity_at || request.submitted_at;
  const editHref = `/profile/project-requests/${request.id}/edit`;
  const title = request.project_type?.trim()
    ? displaySlug(request.project_type)
    : "Project request";

  return (
    <div className="mx-auto max-w-4xl pt-28 pb-12 sm:pt-32 px-5 sm:px-8">
      <Link href="/profile" className="mb-8 inline-block text-sm text-muted hover:text-accent">
        &larr; Back to Profile
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold tracking-wider text-accent uppercase">
              {request.request_number}
            </span>
            <Badge className={getRequestStatusStyle(request.status)}>
              {formatClientRequestStatusLabel(request.status)}
            </Badge>
          </div>
          <h1 className="font-display mt-2 text-3xl tracking-tight sm:text-4xl">{title}</h1>
          {serviceName ? (
            <p className="mt-2 text-sm text-muted">{serviceName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canResubmit ? (
            <ButtonLink href={editHref} className="h-10 px-4 text-xs">
              Edit & Resubmit
            </ButtonLink>
          ) : canEdit ? (
            <ButtonLink href={editHref} className="h-10 px-4 text-xs">
              Edit request
            </ButtonLink>
          ) : null}
          {canCancel ? (
            <CancelRequestButton
              requestId={request.id}
              requestNumber={request.request_number}
            />
          ) : null}
        </div>
      </div>

      {request.status === "rejected" ? (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          This request was rejected. You can edit the brief and resubmit it for review without creating a new request.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6">
        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Overview</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Service / project type" value={displaySlug(request.project_type)} />
            <DetailItem label="Status" value={formatClientRequestStatusLabel(request.status)} />
            <DetailItem
              label="Budget"
              value={formatRequestBudget(
                request.budget_min,
                request.budget_max,
                request.budget_currency || "BDT",
              )}
            />
            <DetailItem
              label="Timeline"
              value={formatRequestDeadline(request.deadline_date, request.deadline_type)}
            />
            <DetailItem label="Submitted" value={formatDateTime(request.submitted_at)} />
            <DetailItem label="Last updated" value={formatDateTime(lastUpdated)} />
          </dl>
        </Card>

        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Client information</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Name" value={request.full_name} />
            <DetailItem label="Email" value={request.email} />
            <DetailItem label="Phone" value={request.phone} />
            <DetailItem label="Company" value={request.company_name} />
          </dl>
        </Card>

        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Requirements</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Website status" value={displaySlug(request.website_status)} />
            <DetailItem label="Page count" value={request.page_count ?? "Not specified"} />
          </dl>
          {request.description ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground">
              {request.description}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">No description submitted.</p>
          )}
          <div className="mt-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Required features
            </p>
            {features.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-card-border px-2.5 py-1 text-xs text-muted"
                  >
                    {displaySlug(feature)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-foreground">None selected</p>
            )}
          </div>
        </Card>

        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Design and preferences</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Has existing design" value={formatYesNo(request.has_design)} />
            <DetailItem label="Design style" value={displaySlug(request.design_style)} />
            <DetailItem label="Has logo" value={formatYesNo(request.has_logo)} />
            <DetailItem label="Has brand colors" value={formatYesNo(request.has_brand_colors)} />
            <DetailItem label="Brand colors" value={request.brand_colors} />
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Figma</dt>
              <dd className="mt-1 text-sm text-foreground">
                {request.figma_url ? (
                  <a
                    href={request.figma_url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline"
                  >
                    {request.figma_url}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Reference URLs
            </p>
            {references.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {references.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-foreground underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-foreground">None provided</p>
            )}
          </div>
        </Card>

        {customFields.length > 0 ? (
          <Card className="hover:translate-y-0">
            <h2 className="font-display text-xl tracking-tight">Additional details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {customFields.map((field) => (
                <DetailItem key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          </Card>
        ) : null}

        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Referral</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Referral code" value={request.referral_code_entered} />
          </dl>
        </Card>

        <Card className="hover:translate-y-0">
          <h2 className="font-display text-xl tracking-tight">Uploaded files</h2>
          {files.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No files are attached to this request yet.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-card-border">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{file.original_name}</p>
                    <p className="mt-1 flex gap-2 text-xs text-muted">
                      <span className="capitalize">{file.category}</span>
                      <span>•</span>
                      <span>{formatBytes(file.file_size_bytes)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                    </p>
                  </div>
                  <FileDownloader bucketName={file.bucket_name} storagePath={file.storage_path} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {quote ? (
          <Card className="hover:translate-y-0">
            <h2 className="font-display text-xl tracking-tight">Quote</h2>
            <p className="mt-4 text-sm font-medium">
              {formatMoney(Number(quote.total), quote.currency)}
              <span className="ml-2 text-xs font-normal text-muted">
                Version {quote.version} · {quote.status.replace(/_/g, " ")}
              </span>
            </p>
          </Card>
        ) : null}

        {linkedProject ? (
          <Card className="hover:translate-y-0">
            <h2 className="font-display text-xl tracking-tight">Linked project</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{linkedProject.project_number}</span>
                  <Badge className={getStatusStyle(linkedProject.status)}>
                    {formatStatusLabel(linkedProject.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{linkedProject.title}</p>
              </div>
              <ButtonLink
                href={`/profile/projects/${linkedProject.id}`}
                variant="secondary"
                className="h-10 px-4 text-xs"
              >
                View project
              </ButtonLink>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
