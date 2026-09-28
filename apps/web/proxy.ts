import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@open-boox/shared';
import { decideAccess } from './lib/auth/route-access';
import { needsRefresh, verifyAccessToken } from './lib/auth/session';
import { parseSetCookie } from './lib/auth/set-cookie';
import { REQUEST_PATH_HEADER } from './lib/request-path';

async function callRefresh(request: NextRequest): Promise<string[] | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: '{}',
    });
    return res.headers.getSetCookie();
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  let claims = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, secret);
  const setCookies: string[] = [];

  if (needsRefresh(claims, Math.floor(Date.now() / 1000)) && request.cookies.has(REFRESH_COOKIE)) {
    const refreshed = await callRefresh(request);
    for (const raw of refreshed ?? []) {
      const cookie = parseSetCookie(raw);
      if (!cookie) continue;
      setCookies.push(raw);
      // Mutating request.cookies rewrites the cookie header that Server Components receive in this request.
      if (cookie.value) request.cookies.set(cookie.name, cookie.value);
      else request.cookies.delete(cookie.name);
    }
    if (setCookies.length > 0) {
      claims = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, secret);
    }
  }

  request.headers.set(REQUEST_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  const decision = decideAccess(request.nextUrl.pathname, request.nextUrl.search, claims);
  const response =
    decision.type === 'redirect'
      ? NextResponse.redirect(new URL(decision.to, request.url))
      : NextResponse.next({ request: { headers: request.headers } });
  for (const raw of setCookies) response.headers.append('set-cookie', raw);
  return response;
}

export const config = {
  matcher: ['/((?!api|internal|_next/static|_next/image|favicon.ico).*)'],
};
