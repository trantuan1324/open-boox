import type { Role } from '@open-boox/shared';
import { jwtVerify } from 'jose';

export interface SessionClaims {
  sub: string;
  role: Role;
  exp: number;
}

export const REFRESH_THRESHOLD_SECONDS = 60;

export async function verifyAccessToken(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.role !== 'CUSTOMER' && payload.role !== 'ADMIN') return null;
    return { sub: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export function needsRefresh(claims: SessionClaims | null, nowSeconds: number): boolean {
  return !claims || claims.exp - nowSeconds < REFRESH_THRESHOLD_SECONDS;
}
