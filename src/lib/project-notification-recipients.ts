export const MAX_PROJECT_NOTIFICATION_RECIPIENTS = 5;
export const PROJECT_NOTIFICATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeProjectNotificationEmails(values: unknown): string[] {
  const source = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of source) {
    if (typeof value !== "string") continue;
    const email = value.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }

  return result;
}

export function validateProjectNotificationEmails(
  values: unknown,
  primaryEmail = "",
): string | null {
  const emails = normalizeProjectNotificationEmails(values);
  if (emails.length > MAX_PROJECT_NOTIFICATION_RECIPIENTS) {
    return `You can add up to ${MAX_PROJECT_NOTIFICATION_RECIPIENTS} team notification emails.`;
  }

  const primary = primaryEmail.trim().toLowerCase();
  for (const email of emails) {
    if (!PROJECT_NOTIFICATION_EMAIL_PATTERN.test(email)) {
      return "Please enter valid team notification email addresses.";
    }
    if (primary && email.toLowerCase() === primary) {
      return "Team notification emails must be different from your primary email.";
    }
  }

  return null;
}
