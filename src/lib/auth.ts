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

export function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/profile";
  }

  if (isAdminPath(value)) {
    return "/profile";
  }

  return value;
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
