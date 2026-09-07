"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextArea } from "@/components/ui/form-field";
import { respondToOwnQuote } from "@/lib/customer-quote-actions";
import type { CustomerRequestQuote } from "@/lib/customer-project-requests";

export function ClientQuoteActions({ quote }: { quote: CustomerRequestQuote }) {
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "reject" | "request_changes" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (!quote.canAccept && !quote.canReject && !quote.canRequestChanges) {
    return null;
  }

  async function submit(action: "accept" | "reject" | "request_changes") {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("quoteId", quote.id);
    formData.set("action", action);
    if (message.trim()) {
      formData.set("message", message.trim());
    }
    const result = await respondToOwnQuote(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode(null);
    setMessage("");
    router.refresh();
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {quote.canAccept ? (
          <Button className="h-10 px-4 text-xs" onClick={() => { setError(null); setMode("accept"); }}>
            Accept Quote
          </Button>
        ) : null}
        {quote.canReject ? (
          <Button
            variant="secondary"
            className="h-10 px-4 text-xs"
            onClick={() => { setError(null); setMessage(""); setMode("reject"); }}
          >
            Reject Quote
          </Button>
        ) : null}
        {quote.canRequestChanges ? (
          <Button
            variant="ghost"
            className="h-10 px-4 text-xs"
            onClick={() => { setError(null); setMessage(""); setMode("request_changes"); }}
          >
            Request Changes
          </Button>
        ) : null}
      </div>

      {mode === "accept" ? (
        <Modal
          title="Accept this quote?"
          description={`Quote v${quote.version} will be accepted. The quoted amount cannot be edited after acceptance.`}
          onClose={() => { if (!pending) setMode(null); }}
        >
          <p className="text-sm leading-6 text-muted">
            Accepting confirms the admin quoted price. This quote stays on record for invoicing.
          </p>
          {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>Cancel</Button>
            <Button disabled={pending} onClick={() => { void submit("accept"); }}>
              {pending ? "Accepting…" : "Accept quote"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {mode === "reject" ? (
        <Modal
          title="Reject this quote?"
          description={`Quote v${quote.version} will be marked rejected. You can ask for a revised quote afterwards.`}
          onClose={() => { if (!pending) setMode(null); }}
        >
          <p className="text-sm leading-6 text-muted">
            The current quote is kept for history. An admin can send a new version if you still want to proceed.
          </p>
          <div className="mt-4">
            <TextArea
              id="reject-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Optional reason (for example, the quoted amount is too high)"
            />
          </div>
          {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>Keep quote</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={pending}
              onClick={() => { void submit("reject"); }}
            >
              {pending ? "Rejecting…" : "Reject quote"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {mode === "request_changes" ? (
        <Modal
          title="Request changes"
          description="The current quote stays unchanged. Admin will review your note and can create a new quote version."
          onClose={() => { if (!pending) setMode(null); }}
        >
          <p className="text-sm leading-6 text-muted">
            Use this if the quoted amount is too high or the scope needs adjustment. You cannot edit the admin price yourself.
          </p>
          <div className="mt-4">
            <TextArea
              id="change-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the changes you need"
              required
            />
          </div>
          {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>Cancel</Button>
            <Button disabled={pending || !message.trim()} onClick={() => { void submit("request_changes"); }}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
