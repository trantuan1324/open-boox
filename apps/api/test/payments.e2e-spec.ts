import type { Payment, Prisma } from '@prisma/client';
import request from 'supertest';
import { DomainError } from '../src/common/errors/domain-error';
import { type ChargeOutcome, MockGateway, PaymentGateway } from '../src/payments/payment-gateway';
import type { PaymentOutcomeHandler } from '../src/payments/payment-outcome';
import { PaymentsService } from '../src/payments/payments.service';
import { loginAs } from './auth-helpers';
import { userIdByEmail } from './order-fixtures';
import { createPlans, createSubscription } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('payments', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const pendingPayment = async () => {
    const plans = await createPlans(ctx.prisma);
    const sub = await createSubscription(ctx.prisma, { userId, planId: plans.basic.id, status: 'PENDING_PAYMENT' });
    return ctx.prisma.payment.create({ data: { userId, subscriptionId: sub.id, amount: 79_000 } });
  };
  const callback = (id: string, success: unknown, cookie = customer) =>
    request(ctx.http).post(`/api/payments/${id}/mock-callback`).set('Cookie', cookie).send({ success });
  const statusOf = async (id: string) => (await ctx.prisma.payment.findUniqueOrThrow({ where: { id } })).status;

  describe('HTTP', () => {
    it('shows the owner their payment, including its target', async () => {
      const payment = await pendingPayment();
      await request(ctx.http)
        .get(`/api/payments/${payment.id}`)
        .set('Cookie', customer)
        .expect(200, { id: payment.id, amount: 79_000, status: 'PENDING', orderId: null, subscriptionId: payment.subscriptionId });
    });

    it("returns 404 for another user's payment on GET and callback, and changes nothing", async () => {
      const payment = await pendingPayment();
      const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      await request(ctx.http).get(`/api/payments/${payment.id}`).set('Cookie', other).expect(404);
      await callback(payment.id, true, other).expect(404);
      expect(await statusOf(payment.id)).toBe('PENDING');
    });

    it.each([undefined, 'yes', 1])('rejects success %j with 400', async (success) => {
      const payment = await pendingPayment();
      await callback(payment.id, success).expect(400);
    });
  });

  // Mechanics of settle on a standalone service with its own registry: the app registers real handlers for
  // every target, and registerHandler refuses duplicates (spec §8).
  describe('settle', () => {
    const calls: string[] = [];
    let rejectNextSuccess = false;
    let service: PaymentsService;

    const handler: PaymentOutcomeHandler = {
      async onSucceeded(_tx: Prisma.TransactionClient, payment: Payment) {
        calls.push(`succeeded:${payment.id}`);
        if (rejectNextSuccess) throw new DomainError('SUBSCRIPTION_ALREADY_EXISTS');
      },
      async onFailed(_tx: Prisma.TransactionClient, payment: Payment) {
        calls.push(`failed:${payment.id}`);
      },
    };

    function gatewayAnswering(outcome: ChargeOutcome): PaymentGateway {
      return { createCheckout: (p) => ({ redirectUrl: `/checkout/mock/${p.id}` }), charge: async () => outcome };
    }

    beforeEach(() => {
      calls.length = 0;
      rejectNextSuccess = false;
      service = new PaymentsService(ctx.prisma, new MockGateway());
      service.registerHandler('subscription', handler);
    });

    it('refuses a second handler for the same target', () => {
      expect(() => service.registerHandler('subscription', handler)).toThrow(/already registered/);
    });

    it('settles a success and runs onSucceeded once', async () => {
      const payment = await pendingPayment();
      expect((await service.settle(payment.id, 'SUCCEEDED')).status).toBe('SUCCEEDED');
      expect(calls).toEqual([`succeeded:${payment.id}`]);
    });

    it('settles a failure and runs onFailed once', async () => {
      const payment = await pendingPayment();
      expect((await service.settle(payment.id, 'FAILED')).status).toBe('FAILED');
      expect(calls).toEqual([`failed:${payment.id}`]);
    });

    it('answers a repeated settle with the current status and runs no handler again', async () => {
      const payment = await pendingPayment();
      await service.settle(payment.id, 'SUCCEEDED');
      expect((await service.settle(payment.id, 'FAILED')).status).toBe('SUCCEEDED');
      expect(calls).toHaveLength(1);
    });

    it('runs exactly one handler when success and failure race', async () => {
      const payment = await pendingPayment();
      const results = await Promise.all([service.settle(payment.id, 'SUCCEEDED'), service.settle(payment.id, 'FAILED')]);
      const final = await statusOf(payment.id);
      for (const result of results) expect(result.status).toBe(final);
      expect(calls).toHaveLength(1);
    });

    it('fails the payment and runs onFailed when onSucceeded rejects with a domain error', async () => {
      rejectNextSuccess = true;
      const payment = await pendingPayment();
      expect((await service.settle(payment.id, 'SUCCEEDED')).status).toBe('FAILED');
      expect(calls).toEqual([`succeeded:${payment.id}`, `failed:${payment.id}`]);
    });

    it('throws and leaves the payment PENDING when no handler is registered for the target', async () => {
      const bare = new PaymentsService(ctx.prisma, new MockGateway());
      const payment = await pendingPayment();
      await expect(bare.settle(payment.id, 'SUCCEEDED')).rejects.toThrow(/No payment outcome handler/);
      expect(await statusOf(payment.id)).toBe('PENDING');
    });

    it('charges through the gateway and settles with its answer', async () => {
      const declining = new PaymentsService(ctx.prisma, gatewayAnswering('FAILED'));
      declining.registerHandler('subscription', handler);
      const payment = await pendingPayment();
      expect((await declining.charge(payment.id)).status).toBe('FAILED');
      expect(calls).toEqual([`failed:${payment.id}`]);

      const accepted = await pendingPaymentForNewUser();
      expect((await service.charge(accepted.id)).status).toBe('SUCCEEDED');
    });

    // createPlans inserts fixed codes, so a second payment needs its own user and the plans already created.
    async function pendingPaymentForNewUser() {
      const other = await ctx.prisma.user.create({
        data: { email: 'second@test.vn', passwordHash: 'x', fullName: 'Second', phone: '0900000001' },
      });
      const plan = await ctx.prisma.plan.findFirstOrThrow({ where: { code: 'basic' } });
      const sub = await createSubscription(ctx.prisma, { userId: other.id, planId: plan.id, status: 'PENDING_PAYMENT' });
      return ctx.prisma.payment.create({ data: { userId: other.id, subscriptionId: sub.id, amount: 79_000 } });
    }
  });
});
