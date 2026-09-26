import 'server-only';
import type { PublicUser } from '@open-boox/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from './error';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function forward(path: string, init: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader },
  });
}

export async function apiServer<T>(path: string, init: RequestInit = { cache: 'no-store' }): Promise<T> {
  const res = await forward(path, init);
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as T;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const res = await forward('/auth/me', { cache: 'no-store' });
  if (res.status === 401) return null;
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as PublicUser;
}
