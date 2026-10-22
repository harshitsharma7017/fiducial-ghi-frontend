/**
 * Cookie that remembers whether the desktop sidebar is collapsed to its icon rail. The signed-in
 * layout reads it on the server, so the page renders in the kept state without a layout shift.
 */
export const SIDEBAR_COOKIE = 'erp_sidebar';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === 'collapsed';
}

/** Browser only. Not httpOnly, because the browser writes it; it holds no secret. */
export function writeSidebarCookie(collapsed: boolean): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = collapsed ? 'collapsed' : 'expanded';
  document.cookie = `${SIDEBAR_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}
