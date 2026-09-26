import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { ApiError } from './error';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const unauthenticated = () => json(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'x' });

describe('apiClient', () => {
  const assign = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/account', assign } });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    assign.mockReset();
  });

  it('sends JSON with the content-type header under /api', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await apiClient('/things', { method: 'POST', body: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/things',
      expect.objectContaining({
        method: 'POST',
        body: '{"a":1}',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      }),
    );
  });

  it('refreshes once on 401 and retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, { value: 42 }));
    await expect(apiClient<{ value: number }>('/things')).resolves.toEqual({ value: 42 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/things', '/api/auth/refresh', '/api/things']);
  });

  it('redirects to login with next when the refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(unauthenticated()).mockResolvedValueOnce(unauthenticated());
    await expect(apiClient('/things')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/login?next=%2Faccount');
  });

  it('never refreshes for /auth/* calls such as a wrong-password login', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' }));
    await expect(apiClient('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiClient('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
