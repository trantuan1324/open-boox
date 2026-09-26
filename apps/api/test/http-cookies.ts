import type { Response } from 'supertest';

export function setCookieLines(res: Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : [String(raw)];
}

export function cookiesFrom(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of setCookieLines(res)) {
    const [pair] = line.split(';');
    const eq = pair!.indexOf('=');
    out[pair!.slice(0, eq)] = pair!.slice(eq + 1);
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
