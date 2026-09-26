import { describe, expect, it } from 'vitest';
import { parseSetCookie } from './set-cookie';

describe('parseSetCookie', () => {
  it('reads name and value, ignoring attributes', () => {
    expect(parseSetCookie('access_token=abc.def=; Path=/; HttpOnly')).toEqual({ name: 'access_token', value: 'abc.def=' });
  });

  it('returns an empty value for a cleared cookie', () => {
    expect(parseSetCookie('refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')).toEqual({
      name: 'refresh_token',
      value: '',
    });
  });

  it('returns null for garbage', () => {
    expect(parseSetCookie('=nope')).toBeNull();
    expect(parseSetCookie('novalue')).toBeNull();
  });
});
