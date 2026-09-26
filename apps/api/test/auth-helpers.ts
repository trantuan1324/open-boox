import type { Role } from '@open-boox/shared';
import * as argon2 from 'argon2';
import request from 'supertest';
import { cookieHeader, cookiesFrom } from './http-cookies';
import type { TestContext } from './test-app';

export async function loginAs(ctx: TestContext, role: Role, email = `${role.toLowerCase()}@test.vn`): Promise<string> {
  const password = 'matkhau123';
  await ctx.prisma.user.create({
    data: { email, passwordHash: await argon2.hash(password), fullName: role, phone: '0900000000', role },
  });
  const res = await request(ctx.http).post('/api/auth/login').send({ email, password }).expect(200);
  return cookieHeader(cookiesFrom(res));
}
