import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSafeAdminNextPath,
  getSafeNextPath,
  isAdminLoginPath,
  isAdminPath,
  isProtectedAdminPath,
} from "@/lib/auth";
import type { Database } from "@/types/database";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const requestedPath = `${pathname}${search}`;

  if (!user && pathname.startsWith("/profile")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", getSafeNextPath(requestedPath));
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (!user && isProtectedAdminPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", getSafeAdminNextPath(requestedPath));
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user) {
    if (pathname.startsWith("/profile") || isAdminPath(pathname)) {
      try {
        await supabase.rpc("sync_customer_session");
      } catch {
        // Session refresh should not fail the request if activity sync is unavailable.
      }
    }

    if (isProtectedAdminPath(pathname)) {
      const { data: isAdmin, error } = await supabase.rpc("is_active_admin");
      if (!error && isAdmin !== true) {
        const profileUrl = request.nextUrl.clone();
        profileUrl.pathname = "/profile";
        profileUrl.search = "";
        return copyCookies(response, NextResponse.redirect(profileUrl));
      }
    }

    if (isAdminLoginPath(pathname)) {
      const { data: isAdmin, error } = await supabase.rpc("is_active_admin");
      if (!error && isAdmin === true) {
        const adminUrl = request.nextUrl.clone();
        adminUrl.pathname = getSafeAdminNextPath(
          request.nextUrl.searchParams.get("next"),
        );
        adminUrl.search = "";
        return copyCookies(response, NextResponse.redirect(adminUrl));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
