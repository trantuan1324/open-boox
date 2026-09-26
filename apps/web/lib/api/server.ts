import 'server-only';
import type { PublicUser } from '@open-boox/shared';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { REQUEST_PATH_HEADER } from '../request-path';
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

// Public catalog data: no cookies, so the response is shared by every visitor and cached for 60s (spec §6.2).
export async function apiPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { next: { revalidate: 60 } });
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
    console.error('getCurrentUser failed', error);
    return null;
  }
}
