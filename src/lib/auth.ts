const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/profile";
  }

  return value;
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function getLoginRedirectPath(nextPath: string): string {
  return `/login?next=${encodeURIComponent(getSafeNextPath(nextPath))}`;
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
