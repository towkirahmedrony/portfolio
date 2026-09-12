import { site } from "@/data/site";

/**
 * Pending-referral plumbing shared by the signup UI and the auth callback.
 *
 * The value here is never an authorization decision: whatever code survives the
 * round trip is re-validated in the database (existence, is_active, expiry,
 * self-referral, program settings) before any referral row is created. Storing
 * it in a cookie only keeps the *candidate* code across signup/auth screens.
 */

export const REFERRAL_CODE_PARAM = "ref";

/**
 * Short-lived, and deliberately readable by the browser: the code is public
 * information (it is printed in the share link), so an HttpOnly cookie would
 * buy nothing and would break the client-side fallback claim.
 */
export const PENDING_REFERRAL_COOKIE = "pending-referral";
export const PENDING_REFERRAL_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Live codes are upper-case hex from the database generator. */
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export function normalizeReferralCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Cheap shape check only — the database is the source of truth for whether the
 * code exists, is active, and is still within its expiry window.
 */
export function isPlausibleReferralCode(value: string | null | undefined): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(value));
}

/** First value of a possibly-repeated query param, normalized. */
export function readReferralCodeParam(
  value: string | string[] | null | undefined,
): string {
  if (Array.isArray(value)) {
    return normalizeReferralCode(value[0]);
  }
  return normalizeReferralCode(value);
}

export function buildReferralLink(code: string): string {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return "";
  }
  return `${site.url}/signup?${REFERRAL_CODE_PARAM}=${encodeURIComponent(normalized)}`;
}

/** Append the referral param to an in-app href, preserving any existing query. */
export function withReferralParam(href: string, code: string): string {
  const normalized = normalizeReferralCode(code);
  if (!normalized || !href.startsWith("/")) {
    return href;
  }

  const [path, hash = ""] = href.split("#");
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(REFERRAL_CODE_PARAM, normalized);
  const next = `${pathname}?${params.toString()}`;
  return hash ? `${next}#${hash}` : next;
}

export function readPendingReferralCodeFromCookieHeader(
  cookieHeader: string | null,
): string {
  if (!cookieHeader) {
    return "";
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName?.trim() !== PENDING_REFERRAL_COOKIE) {
      continue;
    }

    const rawValue = rest.join("=").trim();
    if (!rawValue) {
      return "";
    }

    try {
      return normalizeReferralCode(decodeURIComponent(rawValue));
    } catch {
      return normalizeReferralCode(rawValue);
    }
  }

  return "";
}

/* Browser-only helpers (no-ops during SSR). */

export function readPendingReferralCode(): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PENDING_REFERRAL_COOKIE}=`));

  if (!match) {
    return "";
  }

  return readPendingReferralCodeFromCookieHeader(match);
}

export function writePendingReferralCode(code: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const normalized = normalizeReferralCode(code);
  if (!isPlausibleReferralCode(normalized)) {
    return;
  }

  document.cookie = `${PENDING_REFERRAL_COOKIE}=${encodeURIComponent(
    normalized,
  )}; path=/; max-age=${PENDING_REFERRAL_MAX_AGE_SECONDS}; samesite=lax`;
}

export function clearPendingReferralCode(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${PENDING_REFERRAL_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
