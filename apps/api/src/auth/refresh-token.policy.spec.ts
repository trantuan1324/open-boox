import { isRefreshTokenUsable, REFRESH_GRACE_MS } from './refresh-token.policy';

const now = new Date('2026-09-26T10:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const inFuture = new Date(now.getTime() + 60_000);
const base = { expiresAt: inFuture, rotatedAt: null, revokedAt: null };

describe('isRefreshTokenUsable', () => {
  it('accepts a fresh token', () => {
    expect(isRefreshTokenUsable(base, now)).toBe(true);
  });

  it('rejects a revoked token even if never rotated', () => {
    expect(isRefreshTokenUsable({ ...base, revokedAt: ago(1) }, now)).toBe(false);
  });

  it('rejects an expired token', () => {
    expect(isRefreshTokenUsable({ ...base, expiresAt: now }, now)).toBe(false);
  });

  it('accepts a token rotated inside the grace period', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(REFRESH_GRACE_MS - 1) }, now)).toBe(true);
  });

  it('rejects a token rotated exactly at the end of the grace period', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(REFRESH_GRACE_MS) }, now)).toBe(false);
  });

  it('rejects a recently rotated token that was also revoked', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(1000), revokedAt: ago(500) }, now)).toBe(false);
  });
});
