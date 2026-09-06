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
  resolvePostAuthRedirect,
} from "@/lib/auth";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const cookieReturn = readAuthReturnFromCookieHeader(
    request.headers.get("cookie"),
  );
  const nextFromQuery = requestUrl.searchParams.get("next");
  const reasonFromQuery = requestUrl.searchParams.get("reason");
  const queryIsDefault = !nextFromQuery || nextFromQuery === "/profile";
  const next = resolvePostAuthRedirect({
    next:
      cookieReturn.next && queryIsDefault
        ? cookieReturn.next
        : nextFromQuery || cookieReturn.next,
    reason: reasonFromQuery || cookieReturn.reason,
  });
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  function redirectToLogin(error: "oauth" | "verification") {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", error);
    loginUrl.searchParams.set("next", next);
    if (reasonFromQuery === PLACE_ORDER_AUTH_REASON || cookieReturn.reason === PLACE_ORDER_AUTH_REASON) {
      loginUrl.searchParams.set("reason", PLACE_ORDER_AUTH_REASON);
    }
    return clearAuthReturnCookies(NextResponse.redirect(loginUrl));
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

    const destination = isAdminPath(next) ? "/profile" : next;
    const redirect = clearAuthReturnCookies(
      applyCookies(
        NextResponse.redirect(new URL(destination, requestUrl.origin)),
        pendingCookies,
      ),
    );
    return redirect;
  } catch {
    return redirectToLogin("oauth");
  }
}
