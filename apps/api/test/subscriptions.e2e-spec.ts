import type { Plan } from '@prisma/client';
import request from 'supertest';
import { loginAs } from './auth-helpers';
import { userIdByEmail } from './order-fixtures';
import { createPlans, createSubscription, DAY, type PlanCode } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('subscriptions', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;
  let plans: Record<PlanCode, Plan>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    plans = await createPlans(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const post = (path: string, body: object = {}, cookie = customer) =>
    request(ctx.http).post(`/api${path}`).set('Cookie', cookie).send(body);
  const current = async () =>
    (await request(ctx.http).get('/api/subscriptions/current').set('Cookie', customer).expect(200)).body.subscription;
  const callback = (paymentId: string, success: boolean) => post(`/payments/${paymentId}/mock-callback`, { success });
  const subscribe = async (planCode: PlanCode = 'standard') => {
    const res = await post('/subscriptions', { planCode }).expect(201);
    return { subscriptionId: res.body.subscriptionId as string, paymentId: (res.body.redirectUrl as string).split('/').pop()! };
  };
  const active = (planId = plans.standard.id, extra: { nextPlanId?: string; cancelAtPeriodEnd?: boolean } = {}) =>
    createSubscription(ctx.prisma, { userId, planId, ...extra });

  describe('GET /plans', () => {
    it('lists active plans by price, publicly', async () => {
      await ctx.prisma.plan.create({ data: { code: 'old', name: 'Old', maxBooks: 1, monthlyPrice: 10_000, active: false } });
      const res = await request(ctx.http).get('/api/plans').expect(200);
      expect(res.body).toEqual([
        { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79_000 },
        { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119_000 },
        { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179_000 },
      ]);
    });
  });

  describe('POST /subscriptions', () => {
    it('creates a PENDING_PAYMENT subscription and a payment for the plan price', async () => {
      const { subscriptionId, paymentId } = await subscribe('standard');
      const payment = await ctx.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment).toMatchObject({ subscriptionId, orderId: null, amount: 119_000, status: 'PENDING' });
      expect(await current()).toMatchObject({
        id: subscriptionId,
        status: 'PENDING_PAYMENT',
        plan: { code: 'standard' },
        nextPlan: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pendingPaymentId: paymentId,
      });
    });

    it('activates for 30 days when the payment succeeds', async () => {
      const { paymentId } = await subscribe();
      const before = Date.now();
      await callback(paymentId, true).expect(200);
      const sub = await current();
      expect(sub).toMatchObject({ status: 'ACTIVE', pendingPaymentId: null });
      const start = Date.parse(sub.currentPeriodStart);
      expect(start).toBeGreaterThanOrEqual(before - 1000);
      expect(Date.parse(sub.currentPeriodEnd) - start).toBe(30 * DAY);
    });

    it('cancels when the payment fails, and lets the user subscribe again', async () => {
      const { subscriptionId, paymentId } = await subscribe();
      await callback(paymentId, false).expect(200);
      expect((await ctx.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).status).toBe('CANCELLED');
      expect(await current()).toBeNull();
      await subscribe('basic');
    });

    it('refuses a second open subscription with SUBSCRIPTION_ALREADY_EXISTS', async () => {
      await subscribe();
      expect((await post('/subscriptions', { planCode: 'basic' }).expect(409)).body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expect(await ctx.prisma.subscription.count()).toBe(1);
    });

    it('lets exactly one of two concurrent subscribes win', async () => {
      const results = await Promise.all([
        post('/subscriptions', { planCode: 'basic' }),
        post('/subscriptions', { planCode: 'premium' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expect(await ctx.prisma.subscription.count()).toBe(1);
      expect(await ctx.prisma.payment.count()).toBe(1);
    });

    it('rejects an unknown or inactive plan with 400', async () => {
      await ctx.prisma.plan.update({ where: { id: plans.premium.id }, data: { active: false } });
      for (const planCode of ['khong-co', 'premium']) {
        const res = await post('/subscriptions', { planCode }).expect(400);
        expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', fields: { planCode: 'Gói không tồn tại' } });
      }
      await post('/subscriptions', {}).expect(400);
    });

    it('lets an expired user subscribe again', async () => {
      await createSubscription(ctx.prisma, { userId, planId: plans.basic.id, status: 'EXPIRED', periodEnd: new Date(Date.now() - DAY) });
      await subscribe('basic');
    });
  });

  describe('POST /subscriptions/change-plan', () => {
    it('upgrades at once, keeping the period, without a payment', async () => {
      const sub = await active(plans.basic.id, { nextPlanId: plans.basic.id });
      const res = await post('/subscriptions/change-plan', { planCode: 'premium' }).expect(200);
      expect(res.body).toMatchObject({ plan: { code: 'premium' }, nextPlan: null, currentPeriodEnd: sub.currentPeriodEnd!.toISOString() });
      expect(await ctx.prisma.payment.count()).toBe(0);
    });

    it('schedules a downgrade for the next period', async () => {
      await active(plans.premium.id);
      const res = await post('/subscriptions/change-plan', { planCode: 'basic' }).expect(200);
      expect(res.body).toMatchObject({ plan: { code: 'premium' }, nextPlan: { code: 'basic' } });
    });

    it('drops a scheduled downgrade when the current plan is chosen again', async () => {
      await active(plans.premium.id, { nextPlanId: plans.basic.id });
      const res = await post('/subscriptions/change-plan', { planCode: 'premium' }).expect(200);
      expect(res.body).toMatchObject({ plan: { code: 'premium' }, nextPlan: null });
    });

    it('leaves cancelAtPeriodEnd as it is', async () => {
      await active(plans.basic.id, { cancelAtPeriodEnd: true });
      const res = await post('/subscriptions/change-plan', { planCode: 'premium' }).expect(200);
      expect(res.body.cancelAtPeriodEnd).toBe(true);
    });

    it('answers SUBSCRIPTION_INACTIVE without an ACTIVE subscription', async () => {
      expect((await post('/subscriptions/change-plan', { planCode: 'basic' }).expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      await subscribe(); // PENDING_PAYMENT
      expect((await post('/subscriptions/change-plan', { planCode: 'basic' }).expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
    });

    it('rejects an unknown plan with 400', async () => {
      await active();
      await post('/subscriptions/change-plan', { planCode: 'khong-co' }).expect(400);
    });
  });

  describe('POST /subscriptions/cancel and /resume', () => {
    it('sets and clears cancelAtPeriodEnd, idempotently', async () => {
      await active();
      expect((await post('/subscriptions/cancel').expect(200)).body.cancelAtPeriodEnd).toBe(true);
      expect((await post('/subscriptions/cancel').expect(200)).body.cancelAtPeriodEnd).toBe(true);
      expect((await post('/subscriptions/resume').expect(200)).body.cancelAtPeriodEnd).toBe(false);
      expect((await post('/subscriptions/resume').expect(200)).body.cancelAtPeriodEnd).toBe(false);
    });

    it('answers SUBSCRIPTION_INACTIVE without an ACTIVE subscription', async () => {
      await subscribe();
      expect((await post('/subscriptions/cancel').expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      expect((await post('/subscriptions/resume').expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
    });
  });

  it('answers { subscription: null } without an open subscription, and 401 when signed out', async () => {
    expect(await current()).toBeNull();
    await request(ctx.http).get('/api/subscriptions/current').expect(401);
  });

  it('only shows the caller their own subscription', async () => {
    const other = await ctx.prisma.user.create({
      data: { email: 'other@test.vn', passwordHash: 'x', fullName: 'Other', phone: '0900000001' },
    });
    await createSubscription(ctx.prisma, { userId: other.id, planId: plans.basic.id });
    expect(await current()).toBeNull();
  });
});
