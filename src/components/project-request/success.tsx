import { Button, ButtonLink } from "@/components/ui/button";

export function ProjectRequestSuccess({
  onReset,
  requestNumber,
  referralCode,
  mode = "create",
  detailsHref,
}: {
  onReset: () => void;
  requestNumber?: string | null;
  referralCode?: string;
  mode?: "create" | "update" | "resubmit";
  detailsHref?: string;
}) {
  const isUpdate = mode === "update" || mode === "resubmit";
  return (
    <div className="rounded-3xl border border-card-border bg-card px-6 py-14 text-center sm:px-12">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        {isUpdate ? "Request updated" : "Request received"}
      </p>
      <h2 className="font-display mt-3 text-3xl tracking-tight">
        {mode === "resubmit"
          ? "Your request has been resubmitted."
          : isUpdate
            ? "Your project request has been updated."
            : "Thanks! Your project request has been received."}
      </h2>
      {requestNumber ? (
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
          Your request number is{" "}
          <span className="font-medium text-foreground">{requestNumber}</span>.
        </p>
      ) : null}
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
        {isUpdate
          ? "The same request is now back in review. I will follow up with next steps."
          : "I will review the brief and follow up with next steps. Nothing has been billed, and you can send another request if the details change."}
      </p>
      {referralCode ? (
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted">
          Referral code {referralCode} is saved with this request and will be
          verified later.
        </p>
      ) : null}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink href={detailsHref ?? "/profile"}>
          {detailsHref ? "View request details" : "View in profile"}
        </ButtonLink>
        {isUpdate ? (
          <ButtonLink href="/profile" variant="secondary">
            Back to profile
          </ButtonLink>
        ) : (
          <Button variant="secondary" onClick={onReset}>
            Submit another request
          </Button>
        )}
      </div>
    </div>
  );
}
