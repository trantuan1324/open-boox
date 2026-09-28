import 'server-only';
import type { PublicUser } from '@open-boox/shared';
import { cookies, headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { REQUEST_PATH_HEADER } from '../request-path';
import { CATALOG_TAG } from './catalog-tag';
import { ApiError } from './error';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function forward(path: string, init: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader },
  });
}

export async function apiServer<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await forward(path, { cache: 'no-store', ...init });
  if (res.status === 401) {
    const current = (await headers()).get(REQUEST_PATH_HEADER) ?? '/';
    redirect(`/login?next=${encodeURIComponent(current)}`);
  }
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as T;
}

// Public catalog data: no cookies, so the response is shared by every visitor. Tagged so the API can expire it
// right after a write (spec §4.9); the 60s TTL stays as the safety net when that call fails.
// Callers needing no-store: the Data Cache never stores a 404 revalidation, so a cached 200 is never replaced — a deleted book would stay visible forever.
export async function apiPublic<T>(
  path: string,
  init: RequestInit = { next: { revalidate: 60, tags: [CATALOG_TAG] } },
): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as T;
}

// Used by the root layout header: an unreachable or failing API must not take down every page,
// so anything other than a successful response is treated as "not signed in".
export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const res = await forward('/auth/me', { cache: 'no-store' });
    if (res.status === 401) return null;
    if (!res.ok) throw await ApiError.fromResponse(res);
    return (await res.json()) as PublicUser;
  } catch (error) {
    // cookies() signals "this route is dynamic" by throwing; swallowing it made `next build` prerender pages and hit the API.
    unstable_rethrow(error);
    console.error('getCurrentUser failed', error);
    return null;
  }
}
