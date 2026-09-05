import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSafeNextPath, isAdminPath } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  function redirectToLogin(error: "oauth" | "verification") {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", error);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  if (oauthError) {
    return redirectToLogin("oauth");
  }

  try {
    const supabase = await createServerSupabaseClient();

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

    if (isAdminPath(next)) {
      return NextResponse.redirect(new URL("/profile", requestUrl.origin));
    }
  } catch {
    return redirectToLogin("oauth");
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
