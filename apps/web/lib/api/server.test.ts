import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => new Headers({ 'x-request-path': '/account/orders?page=2' }),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  // Stand-in for Next's internal check: rethrows framework control-flow errors such as dynamic-usage bailouts.
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE') throw error;
  },
}));

const { apiServer, apiPublic, getCurrentUser } = await import('./server');
const { redirect } = await import('next/navigation');

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

  it('rethrows Next dynamic-usage bailouts so build-time prerendering stops instead of fetching', async () => {
    const bailout = Object.assign(new Error('Dynamic server usage'), { digest: 'DYNAMIC_SERVER_USAGE' });
    fetchMock.mockRejectedValueOnce(bailout);
    await expect(getCurrentUser()).rejects.toBe(bailout);
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

describe('apiServer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it('defaults to no-store and keeps caller options', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    await apiServer('/things', { method: 'POST', body: '{}' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/things$/),
      expect.objectContaining({ cache: 'no-store', method: 'POST', body: '{}' }),
    );
  });

  it('redirects to login with the current path and query on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(apiServer('/things')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?next=%2Faccount%2Forders%3Fpage%3D2');
  });
});

describe('apiPublic', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('fetches without cookies and revalidates every 60 seconds', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 'c1' }]));
    await expect(apiPublic('/categories')).resolves.toEqual([{ id: 'c1' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/categories$/), { next: { revalidate: 60 } });
  });

  it('throws ApiError with the status on failure', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }, { status: 404 }));
    await expect(apiPublic('/books/nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('supports cache: no-store for callers that must never serve stale data', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ id: 'b1' }))
      .mockResolvedValueOnce(Response.json({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }, { status: 404 }));
    await expect(apiPublic('/books/some-slug', { cache: 'no-store' })).resolves.toEqual({ id: 'b1' });
    await expect(apiPublic('/books/some-slug', { cache: 'no-store' })).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/books\/some-slug$/), { cache: 'no-store' });
  });
});
