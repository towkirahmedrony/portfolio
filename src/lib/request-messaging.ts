import type { RequestStatus } from "@/types/database";

/**
 * Client-initiated messaging on a Project Request is allowed while the
 * request is still active and awaiting a decision (pre-project stage):
 *   new, reviewing, quoted.
 *
 * Everything terminal or taken over by a project is excluded:
 *   draft (not submitted), approved / converted (project chat takes over),
 *   rejected, cancelled.
 *
 * Project messaging (after conversion) follows its own rule: every project
 * status except "cancelled". See the send_request_message /
 * send_project_message RPCs, which enforce these same rules in the database.
 */
export const REQUEST_MESSAGING_ELIGIBLE: RequestStatus[] = [
  "new",
  "reviewing",
  "quoted",
];

export function canClientMessageRequest(status: RequestStatus): boolean {
  return REQUEST_MESSAGING_ELIGIBLE.includes(status);
}
