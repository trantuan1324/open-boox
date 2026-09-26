import { TokensService } from '../src/auth/tokens.service';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('TokensService', () => {
  let ctx: TestContext;
  let tokens: TokensService;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokensService);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    const user = await ctx.prisma.user.create({
      data: { email: 'a@b.vn', passwordHash: 'x', fullName: 'A', phone: '0900000000' },
    });
    userId = user.id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('stores only an HMAC of the refresh token', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    const row = await ctx.prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(tokens.hashRefreshToken(raw));
  });

  it('rotates once and keeps the old token usable during the grace period', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    expect(await tokens.rotateRefreshToken(raw)).toEqual({ userId });
    const firstRotation = (await ctx.prisma.refreshToken.findFirstOrThrow()).rotatedAt;
    expect(firstRotation).not.toBeNull();

    expect(await tokens.rotateRefreshToken(raw)).toEqual({ userId });
    expect((await ctx.prisma.refreshToken.findFirstOrThrow()).rotatedAt).toEqual(firstRotation);
  });

  it('rejects the old token after the grace period', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    await ctx.prisma.refreshToken.updateMany({ data: { rotatedAt: new Date(Date.now() - 31_000) } });
    expect(await tokens.rotateRefreshToken(raw)).toBeNull();
  });

  it('rejects a revoked token immediately', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    await tokens.revokeRefreshToken(raw);
    expect(await tokens.rotateRefreshToken(raw)).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(await tokens.rotateRefreshToken('not-a-real-token')).toBeNull();
  });

  it('signs access tokens that verify, and rejects tampered ones', async () => {
    const token = await tokens.signAccessToken({ id: userId, role: 'CUSTOMER' });
    expect(await tokens.verifyAccessToken(token)).toMatchObject({ sub: userId, role: 'CUSTOMER' });
    expect(await tokens.verifyAccessToken(token.slice(0, -2) + 'xx')).toBeNull();
  });
});
