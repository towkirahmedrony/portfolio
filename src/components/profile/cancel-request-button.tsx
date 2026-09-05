"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cancelOwnProjectRequest } from "@/lib/customer-project-request-actions";

export function CancelRequestButton({
  requestId,
  requestNumber,
}: {
  requestId: string;
  requestNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("requestId", requestId);
    const result = await cancelOwnProjectRequest(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        className="h-10 px-4 text-xs"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Cancel Request
      </Button>
      {open ? (
        <Modal
          title="Cancel this request?"
          description={`Request ${requestNumber} will be marked cancelled. This cannot be undone.`}
          onClose={() => {
            if (!pending) {
              setOpen(false);
            }
          }}
        >
          <p className="text-sm leading-6 text-muted">
            If you cancel, the team will stop reviewing this brief. You can
            submit a new request later if your needs change.
          </p>
          {error ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Keep request
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={pending}
              onClick={() => {
                void confirmCancel();
              }}
            >
              {pending ? "Cancelling…" : "Cancel request"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
