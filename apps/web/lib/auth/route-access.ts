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

export function safeNextPath(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
