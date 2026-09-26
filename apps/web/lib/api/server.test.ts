import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ toString: () => '' }) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { getCurrentUser } = await import('./server');

describe('getCurrentUser', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('returns the user on 200', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: 'u1', email: 'a@b.vn' }));
    await expect(getCurrentUser()).resolves.toMatchObject({ id: 'u1' });
  });

  it('returns null on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null instead of throwing when the API is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null instead of throwing on a 5xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status: 502 }));
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
