const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/auth",
  "/auth/callback",
  "/welcome",
  "/reset-password",
  "/recipes",
  "/restaurants",
  "/about",
  "/support",
]);

const PUBLIC_PREFIX_PATHS = ["/recipe/", "/restaurant/", "/legal/"];

export function isPublicMealMateRoute(pathname: string): boolean {
  return (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix))
  );
}