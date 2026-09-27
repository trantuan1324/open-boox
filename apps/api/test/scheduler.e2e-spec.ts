import request from 'supertest';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, createUser, userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('scheduler jobs', () => {
  let ctx: TestContext;
  let scheduler: SchedulerService;

  beforeAll(async () => {
    ctx = await createTestApp();
    scheduler = ctx.app.get(SchedulerService);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  describe('failStalePayments', () => {
    let customer: string;
    let bookId: string;
    let addressId: string;

    beforeEach(async () => {
      customer = await loginAs(ctx, 'CUSTOMER');
      const userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
      const category = await createCategory(ctx.prisma, 'Văn học', 'van-hoc');
      bookId = (await createBook(ctx.prisma, category.id, { title: 'A', salePrice: 100_000, stock: 5 })).id;
      addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
    });

    async function placeOrder() {
      const res = await request(ctx.http)
        .post('/api/orders')
        .set('Cookie', customer)
        .send({ items: [{ bookId, quantity: 1 }], addressId })
        .expect(201);
      return { orderId: res.body.orderId as string, paymentId: (res.body.redirectUrl as string).split('/').pop()! };
    }
    const minutesFromNow = (m: number) => new Date(Date.now() + m * MINUTE);
    const state = async (orderId: string, paymentId: string) => ({
      order: (await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status,
      payment: (await ctx.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
      stock: (await ctx.prisma.saleStock.findUniqueOrThrow({ where: { bookId } })).quantity,
    });

    it('fails payments pending for more than 30 minutes, cancelling the order and returning stock', async () => {
      const { orderId, paymentId } = await placeOrder();
      await scheduler.failStalePayments(minutesFromNow(31));
      expect(await state(orderId, paymentId)).toEqual({ order: 'CANCELLED', payment: 'FAILED', stock: 5 });
    });

    it('leaves payments younger than 30 minutes alone', async () => {
      const { orderId, paymentId } = await placeOrder();
      await scheduler.failStalePayments(minutesFromNow(29));
      expect(await state(orderId, paymentId)).toEqual({ order: 'PENDING_PAYMENT', payment: 'PENDING', stock: 4 });
    });

    it('does not touch payments that are already settled', async () => {
      const { orderId, paymentId } = await placeOrder();
      await request(ctx.http).post(`/api/payments/${paymentId}/mock-callback`).set('Cookie', customer).send({ success: true }).expect(200);
      await scheduler.failStalePayments(minutesFromNow(31));
      expect(await state(orderId, paymentId)).toEqual({ order: 'PAID', payment: 'SUCCEEDED', stock: 4 });
    });

    it('lets exactly one side win when a success callback races the job', async () => {
      const { orderId, paymentId } = await placeOrder();
      await Promise.all([
        request(ctx.http).post(`/api/payments/${paymentId}/mock-callback`).set('Cookie', customer).send({ success: true }),
        scheduler.failStalePayments(minutesFromNow(31)),
      ]);
      const final = await state(orderId, paymentId);
      expect([
        { order: 'PAID', payment: 'SUCCEEDED', stock: 4 },
        { order: 'CANCELLED', payment: 'FAILED', stock: 5 },
      ]).toContainEqual(final);
    });
  });

  describe('cleanupRefreshTokens', () => {
    it('deletes expired, long-revoked and long-rotated tokens and keeps the rest', async () => {
      const { id: userId } = await createUser(ctx.prisma);
      const now = new Date();
      const at = (ms: number) => new Date(now.getTime() + ms);
      const token = (tokenHash: string, data: { expiresAt: Date; revokedAt?: Date; rotatedAt?: Date }) =>
        ctx.prisma.refreshToken.create({ data: { userId, tokenHash, ...data } });
      await token('keep-valid', { expiresAt: at(DAY) });
      await token('keep-in-grace', { expiresAt: at(DAY), rotatedAt: at(-10_000) });
      await token('keep-revoked-recently', { expiresAt: at(DAY), revokedAt: at(-60 * MINUTE) });
      await token('drop-expired', { expiresAt: at(-MINUTE) });
      await token('drop-revoked', { expiresAt: at(DAY), revokedAt: at(-2 * DAY) });
      await token('drop-rotated', { expiresAt: at(DAY), rotatedAt: at(-2 * DAY) });

      expect(await scheduler.cleanupRefreshTokens(now)).toBe(3);
      const left = await ctx.prisma.refreshToken.findMany({ select: { tokenHash: true }, orderBy: { tokenHash: 'asc' } });
      expect(left.map((t) => t.tokenHash)).toEqual(['keep-in-grace', 'keep-revoked-recently', 'keep-valid']);
    });
  });
});
