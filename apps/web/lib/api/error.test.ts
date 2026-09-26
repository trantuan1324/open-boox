import { describe, expect, it } from 'vitest';
import { ApiError, nullOn404 } from './error';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ApiError.fromResponse', () => {
  it('reads code, message and fields from an API error body', async () => {
    const err = await ApiError.fromResponse(
      json(400, { statusCode: 400, code: 'VALIDATION_ERROR', message: 'bad', fields: { email: 'x' } }),
    );
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'bad', fields: { email: 'x' } });
  });

  it('falls back to INTERNAL_ERROR for a non-JSON body such as a proxy error page', async () => {
    const err = await ApiError.fromResponse(new Response('<html>Bad Gateway</html>', { status: 502 }));
    expect(err).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('falls back to UNAUTHENTICATED for a bare 401', async () => {
    const err = await ApiError.fromResponse(new Response('', { status: 401 }));
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('ignores unknown codes', async () => {
    const err = await ApiError.fromResponse(json(418, { code: 'TEAPOT', message: 'x' }));
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('nullOn404', () => {
  it('returns null for a 404 ApiError', () => {
    expect(nullOn404(new ApiError(404, 'NOT_FOUND', 'x'))).toBeNull();
  });

  it('rethrows anything else', () => {
    const boom = new ApiError(500, 'INTERNAL_ERROR', 'x');
    expect(() => nullOn404(boom)).toThrow(boom);
    expect(() => nullOn404(new Error('network'))).toThrow('network');
  });
});
