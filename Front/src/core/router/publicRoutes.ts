const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function isPublicAuthRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}
