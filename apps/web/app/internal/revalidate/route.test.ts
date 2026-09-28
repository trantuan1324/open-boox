import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

const { POST } = await import('./route');
const { revalidateTag } = await import('next/cache');

const SECRET = 'the-secret-0123456789';
const call = (secret?: string) =>
  POST(
    new Request('http://web/internal/revalidate', {
      method: 'POST',
      headers: secret === undefined ? {} : { 'x-revalidate-secret': secret },
    }),
  );

describe('POST /internal/revalidate', () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    vi.stubEnv('REVALIDATE_SECRET', SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('expires the catalog tag immediately with the right secret', async () => {
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('catalog', { expire: 0 });
  });

  // Different lengths are the common wrong-secret case: comparing digests keeps timingSafeEqual from throwing.
  it.each([undefined, '', 'wrong', `${SECRET}-longer`, SECRET.slice(0, -1)])('answers 401 to secret %j', async (secret) => {
    const res = await call(secret);
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 401 when the server has no secret configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await call('')).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
