const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function getPathnameFromNext(value: string): string {
  return value.split("#")[0]?.split("?")[0] ?? value;
}

export function isAdminPath(pathname: string): boolean {
  const path = getPathnameFromNext(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string): boolean {
  const path = getPathnameFromNext(pathname);
  return path === "/admin/login" || path.startsWith("/admin/login/");
}

export function isProtectedAdminPath(pathname: string): boolean {
  return isAdminPath(pathname) && !isAdminLoginPath(pathname);
}

const ALLOWED_NEXT_PATHNAMES = new Set([
  "/",
  "/profile",
  "/start-project",
  "/projects",
  "/services",
  "/about",
  "/contact",
]);

export const PLACE_ORDER_AUTH_REASON = "place-order";
export const ORDER_SUBMIT_SECTION_ID = "order-submit-section";
export const ORDER_SUBMIT_SECTION_HASH = `#${ORDER_SUBMIT_SECTION_ID}`;
export const PLACE_ORDER_NEXT_PATH = `/start-project${ORDER_SUBMIT_SECTION_HASH}`;
export const AUTH_RETURN_COOKIE = "auth-return-to";
export const AUTH_REASON_COOKIE = "auth-return-reason";
const AUTH_RETURN_COOKIE_MAX_AGE = 600;

function isAllowedNextPathname(pathname: string): boolean {
  if (ALLOWED_NEXT_PATHNAMES.has(pathname)) {
    return true;
  }

  return /^\/profile\/projects\/[A-Za-z0-9_-]+$/.test(pathname);
}

export function getSafeNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://") ||
    /[\0\r\n]/.test(value)
  ) {
    return "/profile";
  }

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.username || parsed.password || parsed.host !== "localhost") {
      return "/profile";
    }

    if (isAdminPath(parsed.pathname) || !isAllowedNextPathname(parsed.pathname)) {
      return "/profile";
    }

    const hash =
      parsed.hash === ORDER_SUBMIT_SECTION_HASH ? parsed.hash : "";
    return `${parsed.pathname}${parsed.search}${hash}`;
  } catch {
    return "/profile";
  }
}

export function isPlaceOrderAuthReason(value: string | null | undefined): boolean {
  return value === PLACE_ORDER_AUTH_REASON;
}

export function isPlaceOrderNextPath(value: string | null | undefined): boolean {
  return getPathnameFromNext(getSafeNextPath(value)) === "/start-project";
}

export function withOrderSubmitHash(nextPath: string): string {
  const safe = getSafeNextPath(nextPath);
  if (getPathnameFromNext(safe) !== "/start-project") {
    return safe;
  }

  try {
    const parsed = new URL(safe, "http://localhost");
    return `${parsed.pathname}${parsed.search}${ORDER_SUBMIT_SECTION_HASH}`;
  } catch {
    return PLACE_ORDER_NEXT_PATH;
  }
}

export function getPlaceOrderReturnPath(currentUrl?: string | null): string {
  if (!currentUrl) {
    return PLACE_ORDER_NEXT_PATH;
  }

  try {
    const parsed = new URL(currentUrl, "http://localhost");
    if (parsed.pathname !== "/start-project") {
      return PLACE_ORDER_NEXT_PATH;
    }

    return withOrderSubmitHash(`${parsed.pathname}${parsed.search}`);
  } catch {
    return PLACE_ORDER_NEXT_PATH;
  }
}

export function resolvePostAuthRedirect(input: {
  next?: string | null;
  reason?: string | null;
}): string {
  const reason = isPlaceOrderAuthReason(input.reason)
    ? PLACE_ORDER_AUTH_REASON
    : null;
  const safe = getSafeNextPath(input.next);

  if (reason || isPlaceOrderNextPath(safe)) {
    if (getPathnameFromNext(safe) === "/start-project") {
      return withOrderSubmitHash(safe);
    }
    return PLACE_ORDER_NEXT_PATH;
  }

  return safe;
}

export function getPlaceOrderLoginPath(): string {
  const params = new URLSearchParams();
  params.set("next", PLACE_ORDER_NEXT_PATH);
  params.set("reason", PLACE_ORDER_AUTH_REASON);
  return `/login?${params.toString()}`;
}

export function getAuthPageHref(
  path: "/login" | "/signup",
  nextPath: string,
  reason?: string | null,
): string {
  const params = new URLSearchParams();
  const destination = resolvePostAuthRedirect({ next: nextPath, reason });
  params.set("next", destination);
  if (isPlaceOrderAuthReason(reason) || isPlaceOrderNextPath(destination)) {
    params.set("reason", PLACE_ORDER_AUTH_REASON);
  }
  return `${path}?${params.toString()}`;
}

export function getSafeAdminNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (!isProtectedAdminPath(value)) {
    return "/admin";
  }

  return value;
}

export function getLoginRedirectPath(nextPath: string): string {
  return `/login?next=${encodeURIComponent(getSafeNextPath(nextPath))}`;
}

export function getAdminLoginRedirectPath(nextPath: string): string {
  return `/admin/login?next=${encodeURIComponent(getSafeAdminNextPath(nextPath))}`;
}

export function isEmailNotConfirmedError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "email_not_confirmed") {
    return true;
  }

  return (error.message ?? "").toLowerCase().includes("email not confirmed");
}

export function getAuthCallbackUrl(
  origin: string,
  nextPath: string,
  reason?: string | null,
): string {
  const destination = resolvePostAuthRedirect({ next: nextPath, reason });
  const params = new URLSearchParams();
  params.set("next", destination);
  if (isPlaceOrderAuthReason(reason) || isPlaceOrderNextPath(destination)) {
    params.set("reason", PLACE_ORDER_AUTH_REASON);
  }
  return `${origin}/auth/callback?${params.toString()}`;
}

export function getEmailRedirectTo(
  origin: string,
  nextPath: string,
  reason?: string | null,
): string {
  return getAuthCallbackUrl(origin, nextPath, reason);
}

function cookieAttributeString(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  return `Path=/; Max-Age=${AUTH_RETURN_COOKIE_MAX_AGE}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

export function persistAuthReturnTo(
  nextPath: string,
  reason?: string | null,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const destination = resolvePostAuthRedirect({ next: nextPath, reason });
  const attrs = cookieAttributeString();
  document.cookie = `${AUTH_RETURN_COOKIE}=${encodeURIComponent(destination)}; ${attrs}`;

  if (isPlaceOrderAuthReason(reason) || isPlaceOrderNextPath(destination)) {
    document.cookie = `${AUTH_REASON_COOKIE}=${PLACE_ORDER_AUTH_REASON}; ${attrs}`;
  }
}

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(/;\s*/);
  const prefix = `${name}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }

  return null;
}

export function readAuthReturnFromCookieHeader(
  cookieHeader: string | null | undefined,
): {
  next: string | null;
  reason: string | null;
} {
  return {
    next: readCookieValue(cookieHeader, AUTH_RETURN_COOKIE),
    reason: readCookieValue(cookieHeader, AUTH_REASON_COOKIE),
  };
}
