import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

const SECRET = 'test-access-secret-0123456789abcdef-xyz';

function token(role: string, expInSeconds: number) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setExpirationTime(Math.floor(Date.now() / 1000) + expInSeconds)
    .sign(new TextEncoder().encode(SECRET));
}

function refreshResponse(status: number, setCookies: string[]) {
  const headers = new Headers();
  for (const c of setCookies) headers.append('set-cookie', c);
  return new Response(null, { status, headers });
}

describe('proxy', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('redirects anonymous visitors of /account to login with next', async () => {
    const res = await proxy(new NextRequest('http://localhost/account?tab=1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Faccount%3Ftab%3D1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call refresh when the access token is fresh', async () => {
    const fresh = await token('CUSTOMER', 900);
    const res = await proxy(
      new NextRequest('http://localhost/account', { headers: { cookie: `access_token=${fresh}; refresh_token=r1` } }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a near-expiry token and forwards the new cookies to the request and the browser', async () => {
    const renewed = await token('CUSTOMER', 900);
    fetchMock.mockResolvedValueOnce(
      refreshResponse(200, [`access_token=${renewed}; Path=/; HttpOnly`, 'refresh_token=r2; Path=/; HttpOnly']),
    );
    const old = await token('CUSTOMER', 30);
    const res = await proxy(
      new NextRequest('http://localhost/account', { headers: { cookie: `access_token=${old}; refresh_token=r1` } }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/auth/refresh',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ cookie: expect.stringContaining('refresh_token=r1') }) }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([
      `access_token=${renewed}; Path=/; HttpOnly`,
      'refresh_token=r2; Path=/; HttpOnly',
    ]);
    // Next.js forwards overridden request cookies to Server Components via this header.
    expect(res.headers.get('x-middleware-request-cookie')).toContain(`access_token=${renewed}`);
  });

  it('lets public pages render when the refresh call fails at the network level', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const res = await proxy(new NextRequest('http://localhost/books', { headers: { cookie: 'refresh_token=r1' } }));
    expect(res.status).toBe(200);
  });

  it('forwards cleared cookies and redirects to login when refresh is rejected on a protected page', async () => {
    fetchMock.mockResolvedValueOnce(
      refreshResponse(401, ['access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']),
    );
    const res = await proxy(new NextRequest('http://localhost/account', { headers: { cookie: 'refresh_token=stale' } }));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Faccount');
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it('treats a forged ADMIN token as anonymous', async () => {
    const forged = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode('attacker-secret-attacker-secret-0000'));
    const res = await proxy(new NextRequest('http://localhost/admin', { headers: { cookie: `access_token=${forged}` } }));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fadmin');
  });

  it('sends a customer away from /admin', async () => {
    const customer = await token('CUSTOMER', 900);
    const res = await proxy(new NextRequest('http://localhost/admin', { headers: { cookie: `access_token=${customer}` } }));
    expect(res.headers.get('location')).toBe('http://localhost/');
  });

  it('fails fast when JWT_ACCESS_SECRET is missing', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', '');
    await expect(proxy(new NextRequest('http://localhost/books'))).rejects.toThrow('JWT_ACCESS_SECRET');
  });

  it('forwards the current path and query to Server Components, overwriting any client value', async () => {
    const res = await proxy(
      new NextRequest('http://localhost/books?q=nha&page=2', { headers: { 'x-request-path': '/spoofed' } }),
    );
    expect(res.headers.get('x-middleware-request-x-request-path')).toBe('/books?q=nha&page=2');
  });
});
