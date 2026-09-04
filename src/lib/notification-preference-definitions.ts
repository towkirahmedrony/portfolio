/**
 * Pure definitions for notification preferences — safe to import from both
 * server and client code (no next/headers, no supabase).
 */
export type NotificationToggleKey =
  | "email_project_updates"
  | "email_messages"
  | "email_quotes"
  | "email_payments"
  | "email_referrals";

/** Centralized notification preference definitions (single source of truth). */
export const NOTIFICATION_TOGGLES: Array<{
  key: NotificationToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "email_project_updates",
    label: "Project update notifications",
    description: "Milestones, phases and project status changes.",
  },
  {
    key: "email_messages",
    label: "Messages",
    description: "New project messages and replies.",
  },
  {
    key: "email_quotes",
    label: "Quotes",
    description: "Quote creation, revisions and acceptances.",
  },
  {
    key: "email_payments",
    label: "Payments",
    description: "Payment confirmations, reminders and invoices.",
  },
  {
    key: "email_referrals",
    label: "Referrals",
    description: "Referral signups, rewards and expirations.",
  },
];

/** Schema defaults — every notification type is on unless saved otherwise. */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationToggleKey,
  boolean
> = {
  email_project_updates: true,
  email_messages: true,
  email_quotes: true,
  email_payments: true,
  email_referrals: true,
};

export type EffectiveNotificationPreferences = Record<
  NotificationToggleKey,
  boolean
>;
