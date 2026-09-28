import type { Plan } from '@prisma/client';
import request from 'supertest';
import { PaymentGateway } from '../src/payments/payment-gateway';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { loginAs } from './auth-helpers';
import { userIdByEmail } from './order-fixtures';
import { createPlans, createSubscription, DAY, type PlanCode } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

const MINUTE = 60_000;

describe('subscription renewal', () => {
  let ctx: TestContext;
  let scheduler: SchedulerService;
  let customer: string;
  let userId: string;
  let plans: Record<PlanCode, Plan>;

  beforeAll(async () => {
    ctx = await createTestApp();
    scheduler = ctx.app.get(SchedulerService);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    plans = await createPlans(ctx.prisma);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const now = new Date('2026-10-01T05:00:00.000Z');
  const due = (extra: { planId?: string; nextPlanId?: string; cancelAtPeriodEnd?: boolean } = {}) =>
    createSubscription(ctx.prisma, { userId, planId: plans.standard.id, periodEnd: new Date(now.getTime() - MINUTE), ...extra });
  const reload = (id: string) => ctx.prisma.subscription.findUniqueOrThrow({ where: { id } });
  const paymentsOf = (subscriptionId: string) =>
    ctx.prisma.payment.findMany({ where: { subscriptionId }, orderBy: { createdAt: 'asc' } });

  it('charges the plan price and starts the next period where the old one ended', async () => {
    const sub = await due();
    await scheduler.renewSubscriptions(now);
    const renewed = await reload(sub.id);
    expect(renewed).toMatchObject({ status: 'ACTIVE', planId: plans.standard.id });
    expect(renewed.currentPeriodStart).toEqual(sub.currentPeriodEnd);
    expect(renewed.currentPeriodEnd!.getTime() - sub.currentPeriodEnd!.getTime()).toBe(30 * DAY);
    expect(await paymentsOf(sub.id)).toMatchObject([{ amount: 119_000, status: 'SUCCEEDED' }]);
  });

  it('switches to the scheduled plan and charges its price', async () => {
    const sub = await due({ planId: plans.premium.id, nextPlanId: plans.basic.id });
    await scheduler.renewSubscriptions(now);
    expect(await reload(sub.id)).toMatchObject({ status: 'ACTIVE', planId: plans.basic.id, nextPlanId: null });
    expect(await paymentsOf(sub.id)).toMatchObject([{ amount: 79_000, status: 'SUCCEEDED' }]);
  });

  it('expires a subscription cancelled at period end, without a payment', async () => {
    const sub = await due({ cancelAtPeriodEnd: true });
    await scheduler.renewSubscriptions(now);
    expect((await reload(sub.id)).status).toBe('EXPIRED');
    expect(await paymentsOf(sub.id)).toHaveLength(0);
  });

  it('expires the subscription when the gateway declines', async () => {
    jest.spyOn(ctx.app.get(PaymentGateway), 'charge').mockResolvedValueOnce('FAILED');
    const sub = await due();
    await scheduler.renewSubscriptions(now);
    expect((await reload(sub.id)).status).toBe('EXPIRED');
    expect(await paymentsOf(sub.id)).toMatchObject([{ status: 'FAILED' }]);
  });

  it('leaves subscriptions that are not due alone', async () => {
    const sub = await createSubscription(ctx.prisma, { userId, planId: plans.basic.id, periodEnd: new Date(now.getTime() + MINUTE) });
    await scheduler.renewSubscriptions(now);
    expect(await reload(sub.id)).toMatchObject({ status: 'ACTIVE', currentPeriodEnd: sub.currentPeriodEnd });
    expect(await paymentsOf(sub.id)).toHaveLength(0);
  });

  it('renews once when run twice', async () => {
    const sub = await due();
    await scheduler.renewSubscriptions(now);
    await scheduler.renewSubscriptions(now);
    expect(await paymentsOf(sub.id)).toHaveLength(1);
  });

  it('does not charge again while a renewal payment is still pending, and the stale payment expires it once', async () => {
    const sub = await due();
    // A job that died between creating the payment and charging it.
    const stuck = await ctx.prisma.payment.create({
      data: { userId, subscriptionId: sub.id, amount: 119_000, createdAt: new Date(now.getTime() - 31 * MINUTE) },
    });
    await scheduler.renewSubscriptions(now);
    expect(await paymentsOf(sub.id)).toHaveLength(1);
    expect((await reload(sub.id)).status).toBe('ACTIVE');

    await scheduler.failStalePayments(now);
    await scheduler.failStalePayments(now);
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe('FAILED');
    expect((await reload(sub.id)).status).toBe('EXPIRED');
  });

  it('cancels a first subscription payment left pending for 30 minutes', async () => {
    const res = await request(ctx.http).post('/api/subscriptions').set('Cookie', customer).send({ planCode: 'basic' }).expect(201);
    await scheduler.failStalePayments(new Date(Date.now() + 31 * MINUTE));
    expect((await reload(res.body.subscriptionId)).status).toBe('CANCELLED');
  });

  it('keeps plan and charge consistent when a downgrade races the renewal', async () => {
    const realNow = new Date();
    const sub = await createSubscription(ctx.prisma, {
      userId,
      planId: plans.premium.id,
      periodEnd: new Date(realNow.getTime() - MINUTE),
    });
    const [, changed] = await Promise.all([
      scheduler.renewSubscriptions(realNow),
      request(ctx.http).post('/api/subscriptions/change-plan').set('Cookie', customer).send({ planCode: 'basic' }),
    ]);
    expect(changed.status).toBe(200);
    const after = await reload(sub.id);
    const [payment] = await paymentsOf(sub.id);
    const charged = after.planId === plans.basic.id ? 79_000 : 179_000;
    expect(payment).toMatchObject({ amount: charged, status: 'SUCCEEDED' });
    // Either the downgrade was locked into this renewal, or it waits for the next one.
    if (after.planId === plans.basic.id) expect(after.nextPlanId).toBeNull();
    else expect(after.nextPlanId).toBe(plans.basic.id);
  });
});
