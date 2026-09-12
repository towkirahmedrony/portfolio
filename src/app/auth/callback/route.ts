import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  AUTH_REASON_COOKIE,
  AUTH_RETURN_COOKIE,
  isAdminPath,
  PLACE_ORDER_AUTH_REASON,
  readAuthReturnFromCookieHeader,
  resolveCallbackReturn,
} from "@/lib/auth";
import {
  PENDING_REFERRAL_COOKIE,
  readPendingReferralCodeFromCookieHeader,
} from "@/lib/referral-code";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

// TEMP-DIAG (remove after tracing): short-lived cookie recording exactly what
// this callback received and resolved, so the real OAuth round trip can be
// inspected without touching logs or changing behavior.
const DIAG_COOKIE = "diag_auth_resolve";
const DIAG_MAX_AGE = 180;

function attachDiag(
  response: NextResponse,
  requestUrl: URL,
  cookieHeader: string | null,
  diag: {
    oauthError: string | null;
    code: string | null;
    tokenHash: string | null;
    type: string | null;
    next: string;
    placeOrder: boolean;
  },
) {
  const cookieReturn = readAuthReturnFromCookieHeader(cookieHeader);
  const payload = [
    `path=${requestUrl.pathname}`,
    `qNext=${encodeURIComponent(requestUrl.searchParams.get("next") ?? "")}`,
    `qReason=${encodeURIComponent(requestUrl.searchParams.get("reason") ?? "")}`,
    `err=${encodeURIComponent(diag.oauthError ?? "")}`,
    `hasCode=${diag.code ? 1 : 0}`,
    `hasToken=${diag.tokenHash ? 1 : 0}`,
    `type=${encodeURIComponent(diag.type ?? "")}`,
    `ckNext=${encodeURIComponent(cookieReturn.next ?? "")}`,
    `ckReason=${encodeURIComponent(cookieReturn.reason ?? "")}`,
    `resolved=${encodeURIComponent(diag.next)}`,
    `placeOrder=${diag.placeOrder ? 1 : 0}`,
  ].join("|");
  response.cookies.set(DIAG_COOKIE, payload, {
    path: "/",
    maxAge: DIAG_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.has(value as EmailOtpType);
}

function applyCookies(
  response: NextResponse,
  cookiesToSet: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[],
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

function clearAuthReturnCookies(response: NextResponse) {
  response.cookies.set(AUTH_RETURN_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_REASON_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/**
 * Clear the captured referral candidate once it has been handed to the
 * database. Only called on a successful sign-in; a failed callback keeps the
 * cookie so the code can still be applied on a later retry.
 */
function clearPendingReferralCookie(response: NextResponse) {
  response.cookies.set(PENDING_REFERRAL_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const { next, placeOrder } = resolveCallbackReturn({
    queryNext: requestUrl.searchParams.get("next"),
    queryReason: requestUrl.searchParams.get("reason"),
    cookieHeader: request.headers.get("cookie"),
  });
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  function redirectToLogin(error: "oauth" | "verification") {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", error);
    loginUrl.searchParams.set("next", next);
    if (placeOrder) {
      loginUrl.searchParams.set("reason", PLACE_ORDER_AUTH_REASON);
    }
    return attachDiag(
      clearAuthReturnCookies(NextResponse.redirect(loginUrl)),
      requestUrl,
      request.headers.get("cookie"),
      { oauthError, code, tokenHash, type, next, placeOrder },
    );
  }

  if (oauthError) {
    return redirectToLogin("oauth");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToLogin("verification");
  }

  try {
    const cookieStore = await cookies();
    const pendingCookies: {
      name: string;
      value: string;
      options?: Parameters<NextResponse["cookies"]["set"]>[2];
    }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Route handlers still attach cookies via the redirect response.
            }
            pendingCookies.push({ name, value, options });
          });
        },
      },
    });

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return redirectToLogin("verification");
      }
    } else if (tokenHash && isEmailOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (error) {
        return redirectToLogin("verification");
      }
    } else {
      return redirectToLogin("verification");
    }

    try {
      await supabase.rpc("sync_customer_session");
    } catch {
      // Session is already established; profile sync retries on the next authenticated request.
    }

    // Apply a referral captured from /signup?ref=... . The database validates
    // the code (existence, active, expiry, self-referral, program state) and is
    // idempotent, so repeats and unconfirmed-at-signup flows are both safe.
    const pendingReferral = readPendingReferralCodeFromCookieHeader(
      request.headers.get("cookie"),
    );
    if (pendingReferral) {
      try {
        await supabase.rpc("claim_my_referral", { p_code: pendingReferral });
      } catch {
        // Referral bookkeeping must never block sign-in.
      }
    }

    const destination = isAdminPath(next) ? "/profile" : next;
    const redirect = attachDiag(
      clearAuthReturnCookies(
        clearPendingReferralCookie(
          applyCookies(
            NextResponse.redirect(new URL(destination, requestUrl.origin)),
            pendingCookies,
          ),
        ),
      ),
      requestUrl,
      request.headers.get("cookie"),
      { oauthError: null, code, tokenHash, type, next, placeOrder },
    );
    return redirect;
  } catch {
    return redirectToLogin("oauth");
  }
}
