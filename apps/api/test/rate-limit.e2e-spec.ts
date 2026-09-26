import request from 'supertest';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('auth rate limit', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    delete process.env.AUTH_LOGIN_RATE_LIMIT;
    delete process.env.AUTH_REGISTER_RATE_LIMIT;
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const login = (ip: string) =>
    request(ctx.http)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@test.vn', password: 'sai-mat-khau' });

  it('allows 10 logins per minute per client IP, then answers 429 TOO_MANY_REQUESTS', async () => {
    for (let i = 0; i < 10; i++) await login('10.0.0.1').expect(401);
    const res = await login('10.0.0.1').expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    await login('10.0.0.2').expect(401);
  });

  it('allows 5 registrations per minute per client IP', async () => {
    const register = (i: number) =>
      request(ctx.http)
        .post('/api/auth/register')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({ email: `u${i}@test.vn`, password: 'matkhau123', fullName: 'U', phone: '0900000000' });
    for (let i = 0; i < 5; i++) await register(i).expect(201);
    await register(5).expect(429);
  });

  it('does not throttle other auth routes', async () => {
    for (let i = 0; i < 12; i++) {
      await request(ctx.http).post('/api/auth/refresh').set('X-Forwarded-For', '10.0.0.4').send({}).expect(401);
    }
  });
});
