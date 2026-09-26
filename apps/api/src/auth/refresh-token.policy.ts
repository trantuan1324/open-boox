export const REFRESH_GRACE_MS = 30_000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCESS_TTL_SECONDS = 15 * 60;

export interface RefreshTokenState {
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export function isRefreshTokenUsable(token: RefreshTokenState, now: Date): boolean {
  if (token.revokedAt) return false;
  if (token.expiresAt.getTime() <= now.getTime()) return false;
  if (token.rotatedAt && now.getTime() - token.rotatedAt.getTime() >= REFRESH_GRACE_MS) return false;
  return true;
}
