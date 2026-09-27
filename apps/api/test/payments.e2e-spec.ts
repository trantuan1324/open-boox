import type { Payment, Prisma } from '@prisma/client';
import request from 'supertest';
import { DomainError } from '../src/common/errors/domain-error';
import type { PaymentOutcomeHandler } from '../src/payments/payment-outcome';
import { PaymentsService } from '../src/payments/payments.service';
import { loginAs } from './auth-helpers';
import { userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('payments', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;
  const calls: string[] = [];
  let rejectNextSuccess = false;

  const handler: PaymentOutcomeHandler = {
    async onSucceeded(_tx: Prisma.TransactionClient, payment: Payment) {
      calls.push(`succeeded:${payment.id}`);
      if (rejectNextSuccess) throw new DomainError('SUBSCRIPTION_ALREADY_EXISTS');
    },
    async onFailed(_tx: Prisma.TransactionClient, payment: Payment) {
      calls.push(`failed:${payment.id}`);
    },
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.app.get(PaymentsService).registerHandler('subscription', handler);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    calls.length = 0;
    rejectNextSuccess = false;
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const pendingPayment = () =>
    ctx.prisma.payment.create({ data: { userId, subscriptionId: 'sub-test', amount: 79_000 } });
  const callback = (id: string, success: unknown, cookie = customer) =>
    request(ctx.http).post(`/api/payments/${id}/mock-callback`).set('Cookie', cookie).send({ success });
  const statusOf = async (id: string) => (await ctx.prisma.payment.findUniqueOrThrow({ where: { id } })).status;

  it('refuses a second handler for the same target', () => {
    expect(() => ctx.app.get(PaymentsService).registerHandler('subscription', handler)).toThrow(/already registered/);
  });

  it('shows the owner their payment', async () => {
    const payment = await pendingPayment();
    await request(ctx.http)
      .get(`/api/payments/${payment.id}`)
      .set('Cookie', customer)
      .expect(200, { id: payment.id, amount: 79_000, status: 'PENDING', orderId: null });
  });

  it("returns 404 for another user's payment on GET and callback, and changes nothing", async () => {
    const payment = await pendingPayment();
    const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
    await request(ctx.http).get(`/api/payments/${payment.id}`).set('Cookie', other).expect(404);
    await callback(payment.id, true, other).expect(404);
    expect(await statusOf(payment.id)).toBe('PENDING');
    expect(calls).toEqual([]);
  });

  it('settles a successful callback and runs onSucceeded once', async () => {
    const payment = await pendingPayment();
    expect((await callback(payment.id, true).expect(200)).body.status).toBe('SUCCEEDED');
    expect(calls).toEqual([`succeeded:${payment.id}`]);
  });

  it('settles a failed callback and runs onFailed once', async () => {
    const payment = await pendingPayment();
    expect((await callback(payment.id, false).expect(200)).body.status).toBe('FAILED');
    expect(calls).toEqual([`failed:${payment.id}`]);
  });

  it('answers a repeated callback with the current status and runs no handler again', async () => {
    const payment = await pendingPayment();
    await callback(payment.id, true).expect(200);
    expect((await callback(payment.id, false).expect(200)).body.status).toBe('SUCCEEDED');
    expect(calls).toHaveLength(1);
  });

  it('runs exactly one handler when success and failure callbacks race', async () => {
    const payment = await pendingPayment();
    const results = await Promise.all([callback(payment.id, true), callback(payment.id, false)]);
    const final = await statusOf(payment.id);
    for (const res of results) expect(res.body.status).toBe(final);
    expect(calls).toHaveLength(1);
  });

  it('fails the payment and runs onFailed when onSucceeded rejects with a domain error', async () => {
    rejectNextSuccess = true;
    const payment = await pendingPayment();
    expect((await callback(payment.id, true).expect(200)).body.status).toBe('FAILED');
    expect(calls).toEqual([`succeeded:${payment.id}`, `failed:${payment.id}`]);
  });

  it.each([undefined, 'yes', 1])('rejects success %j with 400', async (success) => {
    const payment = await pendingPayment();
    await callback(payment.id, success).expect(400);
  });
});
