import { Logger } from '@nestjs/common';
import { RevalidationService } from './revalidation.service';

describe('RevalidationService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const configured = () => new RevalidationService({ webUrl: 'http://web:3000', secret: 'the-secret' });

  it('does nothing without a web URL or a secret', async () => {
    await new RevalidationService({}).catalogChanged();
    await new RevalidationService({ webUrl: 'http://web:3000' }).catalogChanged();
    await new RevalidationService({ secret: 'the-secret' }).catalogChanged();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the web revalidate route with the secret header', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await configured().catalogChanged();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://web:3000/internal/revalidate',
      expect.objectContaining({ method: 'POST', headers: { 'x-revalidate-secret': 'the-secret' } }),
    );
  });

  it('never rejects: a network error or an error status is only logged', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    await expect(configured().catalogChanged()).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(configured().catalogChanged()).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
  });
});
