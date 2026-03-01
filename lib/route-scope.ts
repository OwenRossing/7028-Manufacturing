export function isProjectScopedPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/parts") || pathname.startsWith("/import");
}
