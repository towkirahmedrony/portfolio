import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { ConfirmSubmitButton } from "@/components/admin/projects/confirm-button";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import {
  convertProjectRequest,
  updateProjectRequestStatus,
} from "@/lib/admin-project-request-actions";
import {
  convertBlockedReason,
  displaySlug,
  formatDateTime,
  formatRequestBudget,
  formatRequestDeadline,
  formatRequestStatusLabel,
  formatYesNo,
  getRequestStatusStyle,
  REQUEST_STATUSES,
  type AdminProjectRequestDetail,
} from "@/lib/admin-project-requests";
import { clientDisplayName } from "@/lib/admin-project-constants";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{value == null || value === "" ? "—" : value}</dd>
    </div>
  );
}

export function ProjectRequestDetail({
  request,
}: {
  request: AdminProjectRequestDetail;
}) {
  const alreadyConverted = Boolean(request.linkedProject);
  const blocked = convertBlockedReason(
    request.status,
    Boolean(request.client_id),
    alreadyConverted,
  );
  const editableStatuses = REQUEST_STATUSES.filter((status) => status !== "converted");
  const features = request.required_features ?? [];
  const references = request.reference_urls ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <AdminPanel title="Client information">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <DetailItem label="Name" value={request.full_name} />
            <DetailItem label="Email" value={request.email} />
            <DetailItem label="Phone" value={request.phone} />
            <DetailItem label="Company" value={request.company_name} />
            <div>
              <dt className="text-muted">Linked profile</dt>
              <dd className="text-foreground">
                {request.client && request.client_id ? (
                  <Link
                    href={`/admin/clients/${request.client_id}`}
                    className="hover:underline"
                  >
                    {clientDisplayName(request.client)}
                  </Link>
                ) : (
                  "Anonymous submission"
                )}
              </dd>
            </div>
            <DetailItem label="Service" value={request.serviceName} />
          </dl>
        </AdminPanel>

        <AdminPanel title="Project requirements">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <DetailItem label="Project type" value={displaySlug(request.project_type)} />
            <DetailItem label="Website status" value={displaySlug(request.website_status)} />
            <DetailItem label="Page count" value={request.page_count} />
            <DetailItem
              label="Deadline"
              value={formatRequestDeadline(request.deadline_date, request.deadline_type)}
            />
          </dl>
          {request.description ? (
            <div className="mt-4">
              <p className="text-sm text-muted">Description</p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                {request.description}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No description submitted.</p>
          )}
          <div className="mt-4">
            <p className="text-sm text-muted">Required features</p>
            {features.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {features.map((feature: string) => (
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
        </AdminPanel>

        <AdminPanel title="Design and references">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <DetailItem label="Has existing design" value={formatYesNo(request.has_design)} />
            <DetailItem label="Design style" value={displaySlug(request.design_style)} />
            <DetailItem label="Has logo" value={formatYesNo(request.has_logo)} />
            <DetailItem label="Has brand colors" value={formatYesNo(request.has_brand_colors)} />
            <DetailItem label="Brand colors" value={request.brand_colors} />
            <div>
              <dt className="text-muted">Figma</dt>
              <dd className="text-foreground">
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
            <p className="text-sm text-muted">Reference URLs</p>
            {references.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {references.map((url: string) => (
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
        </AdminPanel>
      </div>

      <aside className="space-y-6">
        <AdminPanel title="Status">
          <StatusPill
            label={formatRequestStatusLabel(request.status)}
            className={getRequestStatusStyle(request.status)}
          />
          {request.status === "converted" ? (
            <p className="mt-3 text-sm text-muted">
              Converted requests are locked. Open the linked project to continue.
            </p>
          ) : (
            <ActionForm
              action={updateProjectRequestStatus}
              className="mt-4 grid gap-3"
              successMessage="Status updated."
            >
              <input type="hidden" name="requestId" value={request.id} />
              <select
                name="status"
                defaultValue={request.status}
                className={fieldClass}
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatRequestStatusLabel(status)}
                  </option>
                ))}
              </select>
              <SubmitButton>Update status</SubmitButton>
            </ActionForm>
          )}
        </AdminPanel>

        <AdminPanel
          title="Budget"
          description="Canonical budget columns from the submitted request."
        >
          <p className="text-sm text-foreground">
            {formatRequestBudget(
              request.budget_min,
              request.budget_max,
              request.budget_currency || "BDT",
            )}
          </p>
          <p className="mt-2 text-xs text-muted">Currency: {request.budget_currency}</p>
        </AdminPanel>

        <AdminPanel title="Convert to project">
          {request.linkedProject ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                This request is already linked to a project. Duplicate conversion is blocked.
              </p>
              <Link
                href={`/admin/projects/${request.linkedProject.id}`}
                className="inline-flex rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Open {request.linkedProject.project_number}
              </Link>
            </div>
          ) : blocked ? (
            <p className="text-sm text-muted">{blocked}</p>
          ) : (
            <ActionForm
              action={convertProjectRequest}
              className="grid gap-3"
              successMessage="Request converted to a project."
            >
              <input type="hidden" name="requestId" value={request.id} />
              <p className="text-sm text-muted">
                Creates a projects row with this request as request_id, copies the submitted
                scope, and marks the lead converted.
              </p>
              <ConfirmSubmitButton
                message="Convert this approved request into a project? This cannot be undone."
                className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Convert to project
              </ConfirmSubmitButton>
            </ActionForm>
          )}
        </AdminPanel>

        <AdminPanel title="Referral">
          <dl className="grid gap-4 text-sm">
            <DetailItem
              label="Code entered"
              value={request.referral_code_entered}
            />
            <DetailItem
              label="Resolved code"
              value={
                request.referralCode
                  ? `${request.referralCode.code}${request.referralCode.is_active ? "" : " (inactive)"}`
                  : request.referral_code_id
                    ? "Linked, label unavailable"
                    : "Not resolved"
              }
            />
          </dl>
        </AdminPanel>

        <AdminPanel title="Source and timestamps">
          <dl className="grid gap-4 text-sm">
            <DetailItem label="Source" value={request.source} />
            <DetailItem label="Submitted" value={formatDateTime(request.submitted_at)} />
            <DetailItem label="Updated" value={formatDateTime(request.updated_at)} />
          </dl>
        </AdminPanel>

        <AdminPanel
          title="Internal notes"
          description="project_notes is scoped to projects, so notes become available after conversion."
        >
          {request.linkedProject ? (
            <p className="text-sm text-muted">
              Manage internal notes on{" "}
              <Link
                href={`/admin/projects/${request.linkedProject.id}?tab=notes`}
                className="text-foreground underline"
              >
                {request.linkedProject.project_number}
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-muted">
              Convert this request to a project to add internal notes. The schema does not
              store notes on project_requests.
            </p>
          )}
        </AdminPanel>
      </aside>
    </div>
  );
}
