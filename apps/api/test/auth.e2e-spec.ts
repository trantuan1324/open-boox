import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { cookieHeader, cookiesFrom, setCookieLines } from './http-cookies';
import { createTestApp, resetDb, type TestContext } from './test-app';

const newUser = { email: '  An@Mail.COM ', password: 'matkhau123', fullName: 'Nguyễn An', phone: '0912345678' };

describe('auth endpoints', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const register = () => request(ctx.http).post('/api/auth/register').send(newUser);

  describe('register', () => {
    it('creates a user, returns the public profile and sets both cookies', async () => {
      const res = await register().expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'an@mail.com',
        fullName: 'Nguyễn An',
        phone: '0912345678',
        role: 'CUSTOMER',
      });
      const lines = setCookieLines(res);
      for (const name of ['access_token', 'refresh_token']) {
        const line = lines.find((l) => l.startsWith(`${name}=`));
        expect(line).toBeDefined();
        expect(line).toMatch(/HttpOnly/);
        expect(line).toMatch(/SameSite=Lax/);
        expect(line).toMatch(/Path=\//);
        expect(line).not.toMatch(/Secure/);
      }
    });

    it('rejects the same email with different casing as DUPLICATE on the email field', async () => {
      await register().expect(201);
      const res = await request(ctx.http)
        .post('/api/auth/register')
        .send({ ...newUser, email: 'an@mail.com' })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'DUPLICATE', fields: { email: 'Email đã được sử dụng' } });
    });

    it('returns field errors for invalid input', async () => {
      const res = await request(ctx.http)
        .post('/api/auth/register')
        .send({ ...newUser, password: 'short', phone: '123' })
        .expect(400);
      expect(Object.keys(res.body.fields).sort()).toEqual(['password', 'phone']);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('logs in with a differently-cased email', async () => {
      const res = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'AN@mail.com', password: 'matkhau123' })
        .expect(200);
      expect(res.body.email).toBe('an@mail.com');
      expect(cookiesFrom(res).access_token).toBeTruthy();
    });

    it('uses one error for wrong password and unknown email', async () => {
      const wrong = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'an@mail.com', password: 'sai-mat-khau' })
        .expect(401);
      const unknown = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'nobody@mail.com', password: 'matkhau123' })
        .expect(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body).toEqual(wrong.body);
    });
  });

  describe('me', () => {
    it('returns the current user with a valid access cookie', async () => {
      const cookies = cookiesFrom(await register());
      const res = await request(ctx.http)
        .get('/api/auth/me')
        .set('Cookie', cookieHeader({ access_token: cookies.access_token! }))
        .expect(200);
      expect(res.body.email).toBe('an@mail.com');
    });

    it('returns 401 UNAUTHENTICATED without a cookie', async () => {
      const res = await request(ctx.http).get('/api/auth/me').expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('rejects an ADMIN token signed with a different secret', async () => {
      const registered = await register();
      const forged = await new JwtService().signAsync(
        { sub: registered.body.id, role: 'ADMIN' },
        { secret: 'attacker-secret-attacker-secret-0000', algorithm: 'HS256', expiresIn: 900 },
      );
      await request(ctx.http).get('/api/auth/me').set('Cookie', `access_token=${forged}`).expect(401);
    });
  });

  describe('refresh', () => {
    const refresh = (refreshToken: string) =>
      request(ctx.http)
        .post('/api/auth/refresh')
        .set('Content-Type', 'application/json')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .send('{}');

    it('issues new cookies and keeps the old token usable during the grace period', async () => {
      const original = cookiesFrom(await register()).refresh_token!;
      const first = await refresh(original).expect(200);
      expect(cookiesFrom(first).refresh_token).toBeTruthy();
      expect(cookiesFrom(first).refresh_token).not.toBe(original);
      await refresh(original).expect(200);
    });

    it('lets three concurrent refreshes with the same token all succeed', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      const results = await Promise.all([refresh(token), refresh(token), refresh(token)]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    });

    it('rejects a rotated token after the grace period and clears cookies', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      await refresh(token).expect(200);
      await ctx.prisma.refreshToken.updateMany({
        where: { rotatedAt: { not: null } },
        data: { rotatedAt: new Date(Date.now() - 31_000) },
      });
      const res = await refresh(token).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
      expect(cookiesFrom(res)).toMatchObject({ access_token: '', refresh_token: '' });
    });

    it('returns 401 without a refresh cookie', async () => {
      await request(ctx.http).post('/api/auth/refresh').send({}).expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token immediately and clears cookies', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      const res = await request(ctx.http)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${token}`)
        .send({})
        .expect(204);
      expect(cookiesFrom(res)).toMatchObject({ access_token: '', refresh_token: '' });
      await request(ctx.http)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${token}`)
        .send({})
        .expect(401);
    });
  });

  it('keeps /api/health public now that the JWT guard is global', async () => {
    await request(ctx.http).get('/api/health').expect(200);
  });
});
