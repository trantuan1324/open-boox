import { describe, expect, it } from 'vitest';
import { decideAccess, safeNextPath } from './route-access';

const customer = { role: 'CUSTOMER' as const };
const admin = { role: 'ADMIN' as const };

describe('decideAccess', () => {
  it.each(['/', '/books', '/accounting', '/administrator', '/login'])('allows %s anonymously', (path) => {
    expect(decideAccess(path, '', null)).toEqual({ type: 'allow' });
  });

  it.each(['/account', '/account/orders', '/checkout', '/borrow/confirm', '/admin', '/admin/orders'])(
    'sends anonymous users on %s to login',
    (path) => {
      expect(decideAccess(path, '', null)).toEqual({
        type: 'redirect',
        to: `/login?next=${encodeURIComponent(path)}`,
      });
    },
  );

  it('keeps the query string in next', () => {
    expect(decideAccess('/account/orders', '?page=2', null)).toEqual({
      type: 'redirect',
      to: '/login?next=%2Faccount%2Forders%3Fpage%3D2',
    });
  });

  it('sends customers away from /admin to home', () => {
    expect(decideAccess('/admin/orders', '', customer)).toEqual({ type: 'redirect', to: '/' });
  });

  it('lets customers into /account and admins into /admin', () => {
    expect(decideAccess('/account', '', customer)).toEqual({ type: 'allow' });
    expect(decideAccess('/admin', '', admin)).toEqual({ type: 'allow' });
  });
});

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/account/orders?page=2')).toBe('/account/orders?page=2');
  });

  it.each([
    undefined,
    null,
    '',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'account',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
  ])(
    'falls back to /account for %s',
    (raw) => {
      expect(safeNextPath(raw)).toBe('/account');
    },
  );
});
