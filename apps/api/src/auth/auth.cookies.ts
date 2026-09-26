import type { Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@open-boox/shared';
import { getEnv } from '../config/env';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS } from './refresh-token.policy';

function baseOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: getEnv().NODE_ENV === 'production', path: '/' };
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions(), maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
