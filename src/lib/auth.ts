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

const PLACE_ORDER_REASON = "place-order";

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

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/profile";
  }
}

export function isPlaceOrderAuthReason(value: string | null | undefined): boolean {
  return value === PLACE_ORDER_REASON;
}

export function getPlaceOrderLoginPath(): string {
  const params = new URLSearchParams();
  params.set("next", "/start-project");
  params.set("reason", PLACE_ORDER_REASON);
  return `/login?${params.toString()}`;
}

export function getAuthPageHref(
  path: "/login" | "/signup",
  nextPath: string,
  reason?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("next", getSafeNextPath(nextPath));
  if (isPlaceOrderAuthReason(reason)) {
    params.set("reason", PLACE_ORDER_REASON);
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

export function getEmailRedirectTo(origin: string, nextPath: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(nextPath))}`;
}
