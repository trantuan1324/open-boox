import type { Role } from '@open-boox/shared';

export type AccessDecision = { type: 'allow' } | { type: 'redirect'; to: string };

const LOGIN_REQUIRED = ['/account', '/checkout', '/borrow'];
const ALLOW: AccessDecision = { type: 'allow' };

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function decideAccess(pathname: string, search: string, session: { role: Role } | null): AccessDecision {
  const adminOnly = under(pathname, '/admin');
  const loginRequired = adminOnly || LOGIN_REQUIRED.some((prefix) => under(pathname, prefix));
  if (!loginRequired) return ALLOW;
  if (!session) return { type: 'redirect', to: `/login?next=${encodeURIComponent(pathname + search)}` };
  if (adminOnly && session.role !== 'ADMIN') return { type: 'redirect', to: '/' };
  return ALLOW;
}

const SAME_ORIGIN_BASE = 'http://same-origin.invalid';

export function safeNextPath(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw || !raw.startsWith('/')) return fallback;
  // Let the WHATWG URL parser decide, the same way the browser will: it strips tab/newline
  // characters, so "/\t/evil.com" becomes "//evil.com" and must be rejected.
  const url = new URL(raw, SAME_ORIGIN_BASE);
  if (url.origin !== SAME_ORIGIN_BASE) return fallback;
  return url.pathname + url.search + url.hash;
}
