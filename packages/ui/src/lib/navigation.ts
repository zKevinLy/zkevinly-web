// Path helpers shared by the build (Header) and the browser (Header's active-link script).
// Keep this file free of Node-only APIs.

/** "/projects/" -> "/projects", "" -> "/". */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

/** True when `pathname` is `href` or anywhere below it. */
export function isActivePath(pathname: string, href: string): boolean {
  const path = normalizePath(pathname);
  return path === href || path.startsWith(href + '/');
}
