import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { needsRefresh, verifyAccessToken } from './session';

const SECRET = 'test-access-secret-0123456789abcdef-xyz';
const key = (s: string) => new TextEncoder().encode(s);
const now = () => Math.floor(Date.now() / 1000);

function sign(payload: Record<string, unknown>, expInSeconds: number, secret = SECRET) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setExpirationTime(now() + expInSeconds)
    .sign(key(secret));
}

describe('verifyAccessToken', () => {
  it('returns claims for a valid token', async () => {
    const token = await sign({ role: 'ADMIN' }, 900);
    expect(await verifyAccessToken(token, SECRET)).toMatchObject({ sub: 'user-1', role: 'ADMIN' });
  });

  it('rejects an ADMIN token signed with another secret', async () => {
    const token = await sign({ role: 'ADMIN' }, 900, 'attacker-secret-attacker-secret-0000');
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    expect(await verifyAccessToken(await sign({ role: 'CUSTOMER' }, -10), SECRET)).toBeNull();
  });

  it('rejects an unknown role and a missing token', async () => {
    expect(await verifyAccessToken(await sign({ role: 'ROOT' }, 900), SECRET)).toBeNull();
    expect(await verifyAccessToken(undefined, SECRET)).toBeNull();
  });
});

describe('needsRefresh', () => {
  it('is true without a session or when under 60 seconds remain', () => {
    expect(needsRefresh(null, 1000)).toBe(true);
    expect(needsRefresh({ sub: 'u', role: 'CUSTOMER', exp: 1059 }, 1000)).toBe(true);
  });

  it('is false with 60 seconds or more remaining', () => {
    expect(needsRefresh({ sub: 'u', role: 'CUSTOMER', exp: 1060 }, 1000)).toBe(false);
  });
});
