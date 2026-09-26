import request from 'supertest';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns ok under the /api prefix', async () => {
    await request(ctx.http).get('/api/health').expect(200, { status: 'ok' });
  });

  it('can truncate all tables in the test database', async () => {
    await expect(resetDb(ctx.prisma)).resolves.toBeUndefined();
  });
});
