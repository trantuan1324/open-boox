import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import type { AuthUser } from '../src/auth/auth-user';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { loginAs } from './auth-helpers';
import { createTestApp, resetDb, type TestContext } from './test-app';

@Controller('test-rbac')
class RbacTestController {
  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Get('any')
  any(@CurrentUser() user: AuthUser) {
    return { role: user.role };
  }
}

describe('RBAC', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [RbacTestController] });
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns 401 for anonymous callers before checking roles', async () => {
    const res = await request(ctx.http).get('/api/test-rbac/admin').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN for a customer on an admin route', async () => {
    const cookie = await loginAs(ctx, 'CUSTOMER');
    const res = await request(ctx.http).get('/api/test-rbac/admin').set('Cookie', cookie).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows an admin on an admin route', async () => {
    const cookie = await loginAs(ctx, 'ADMIN');
    await request(ctx.http).get('/api/test-rbac/admin').set('Cookie', cookie).expect(200, { ok: true });
  });

  it('allows any logged-in role on routes without @Roles', async () => {
    const cookie = await loginAs(ctx, 'CUSTOMER');
    await request(ctx.http).get('/api/test-rbac/any').set('Cookie', cookie).expect(200, { role: 'CUSTOMER' });
  });
});
