import type { Plan } from '@prisma/client';
import request from 'supertest';
import { RevalidationService } from '../src/revalidation/revalidation.service';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { markActive } from './loan-fixtures';
import { ADDRESS_INPUT, createAddress, userIdByEmail } from './order-fixtures';
import { createPlans, createSubscription, DAY, type PlanCode } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('loans', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;
  let addressId: string;
  let categoryId: string;
  let plans: Record<PlanCode, Plan>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
    plans = await createPlans(ctx.prisma);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const book = async (copies: Array<'AVAILABLE' | 'LOST'> = ['AVAILABLE']) =>
    (await createBook(ctx.prisma, categoryId, { title: `Sách ${Math.random()}`, copies })).id;
  const subscribe = (plan: PlanCode = 'standard', periodEnd?: Date, owner = userId) =>
    createSubscription(ctx.prisma, { userId: owner, planId: plans[plan].id, periodEnd });
  const borrow = (bookIds: string[], cookie = customer, address = addressId) =>
    request(ctx.http).post('/api/loans').set('Cookie', cookie).send({ bookIds, addressId: address });
  const giveBack = (loanIds: string[], cookie = customer, address = addressId) =>
    request(ctx.http).post('/api/loans/return').set('Cookie', cookie).send({ loanIds, addressId: address });
  const copyStatuses = async (bookId: string) =>
    (await ctx.prisma.bookCopy.findMany({ where: { bookId }, orderBy: { barcode: 'asc' } })).map((c) => c.status);

  describe('POST /loans', () => {
    it('reserves one copy per book and creates one free LOAN_DELIVERY for all of them', async () => {
      const sub = await subscribe('standard');
      const [a, b] = [await book(), await book()];
      const res = await borrow([a, b]).expect(201);
      expect(res.body.loanIds).toHaveLength(2);
      const loans = await ctx.prisma.loan.findMany({ where: { id: { in: res.body.loanIds } }, include: { bookCopy: true } });
      expect(loans.every((l) => l.status === 'REQUESTED' && l.deliveryShipmentId === res.body.shipmentId)).toBe(true);
      expect(loans.every((l) => l.subscriptionId === sub.id && l.bookCopy.status === 'RESERVED')).toBe(true);
      const shipment = await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: res.body.shipmentId }, include: { events: true } });
      expect(shipment).toMatchObject({ type: 'LOAN_DELIVERY', fee: 0, status: 'PENDING', orderId: null, addressSnapshot: ADDRESS_INPUT });
      expect(shipment.events.map((e) => e.status)).toEqual(['PENDING']);
    });

    it('asks the web app to revalidate after a borrow, not after a refused one', async () => {
      const spy = jest.spyOn(ctx.app.get(RevalidationService), 'catalogChanged').mockResolvedValue(undefined);
      await subscribe('basic');
      await borrow([await book()]).expect(201);
      expect(spy).toHaveBeenCalledTimes(1);
      await borrow([await book(['LOST'])]).expect(409);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['no subscription', async () => undefined],
      ['a subscription waiting for payment', async (ctxUser: string) => {
        await createSubscription(ctx.prisma, { userId: ctxUser, planId: plans.basic.id, status: 'PENDING_PAYMENT' });
      }],
      ['an ACTIVE subscription past its period end', async (ctxUser: string) => {
        await createSubscription(ctx.prisma, { userId: ctxUser, planId: plans.basic.id, periodEnd: new Date(Date.now() - 60_000) });
      }],
    ])('answers SUBSCRIPTION_INACTIVE with %s and reserves nothing', async (_label, setup) => {
      await setup(userId);
      const a = await book();
      expect((await borrow([a]).expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      expect(await copyStatuses(a)).toEqual(['AVAILABLE']);
      expect(await ctx.prisma.shipment.count()).toBe(0);
    });

    it('allows exactly maxBooks open loans, counted per user across subscriptions and open statuses', async () => {
      await subscribe('standard'); // maxBooks 3
      const first = await borrow([await book()]).expect(201);
      await markActive(ctx.prisma, first.body.loanIds);
      await giveBack(first.body.loanIds).expect(201); // RETURN_REQUESTED still counts
      await borrow([await book(), await book()]).expect(201); // 1 + 2 = 3 = maxBooks
      expect((await borrow([await book()]).expect(409)).body.code).toBe('LOAN_LIMIT_EXCEEDED');
    });

    it('counts loans from an older subscription too', async () => {
      const old = await createSubscription(ctx.prisma, { userId, planId: plans.premium.id, status: 'EXPIRED', periodEnd: new Date(Date.now() - DAY) });
      const copy = await ctx.prisma.bookCopy.findFirstOrThrow({ where: { bookId: await book() } });
      const delivery = await ctx.prisma.shipment.create({ data: { type: 'LOAN_DELIVERY', fee: 0, addressSnapshot: ADDRESS_INPUT } });
      await ctx.prisma.loan.create({ data: { userId, subscriptionId: old.id, bookCopyId: copy.id, deliveryShipmentId: delivery.id, status: 'ACTIVE' } });
      await subscribe('basic'); // maxBooks 2
      expect((await borrow([await book(), await book()]).expect(409)).body.code).toBe('LOAN_LIMIT_EXCEEDED');
      await borrow([await book()]).expect(201);
    });

    it('rolls everything back with NO_COPY_AVAILABLE, naming the book that has no copy left', async () => {
      await subscribe('premium');
      const [a, b] = [await book(), await book(['LOST'])];
      const { title } = await ctx.prisma.book.findUniqueOrThrow({ where: { id: b }, select: { title: true } });
      const res = await borrow([a, b]).expect(409);
      expect(res.body).toMatchObject({ code: 'NO_COPY_AVAILABLE', fields: { bookIds: `"${title}" đã hết bản cho mượn` } });
      expect(await copyStatuses(a)).toEqual(['AVAILABLE']);
      expect(await ctx.prisma.loan.count()).toBe(0);
      expect(await ctx.prisma.shipment.count()).toBe(0);
    });

    it('answers 400 for a book that does not exist, reserving nothing', async () => {
      await subscribe('premium');
      const a = await book();
      const res = await borrow([a, 'khong-co']).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', fields: { bookIds: 'Có sách không tồn tại' } });
      expect(await copyStatuses(a)).toEqual(['AVAILABLE']);
    });

    it('validates the body and refuses another user’s address with 404', async () => {
      await subscribe('premium');
      const a = await book();
      await borrow([]).expect(400);
      await borrow([a, a]).expect(400);
      await borrow(['1', '2', '3', '4', '5', '6']).expect(400);
      const other = await ctx.prisma.user.create({ data: { email: 'o@test.vn', passwordHash: 'x', fullName: 'O', phone: '0900000001' } });
      const foreign = await createAddress(ctx.prisma, other.id, 'Huế', true);
      await borrow([a], customer, foreign.id).expect(404);
      await request(ctx.http).post('/api/loans').send({ bookIds: [a], addressId }).expect(401);
    });

    it('lets exactly maxBooks of five concurrent single-book borrows succeed', async () => {
      await subscribe('basic'); // maxBooks 2
      const books = await Promise.all(Array.from({ length: 5 }, () => book()));
      const results = await Promise.all(books.map((id) => borrow([id])));
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      const refused = results.filter((r) => r.status === 409);
      expect(refused).toHaveLength(3);
      expect(refused.every((r) => r.body.code === 'LOAN_LIMIT_EXCEEDED')).toBe(true);
      expect(await ctx.prisma.loan.count()).toBe(2);
    });

    it('gives the last copy to exactly one of two users borrowing at once', async () => {
      await subscribe('basic');
      const otherCookie = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      const otherId = await userIdByEmail(ctx.prisma, 'other@test.vn');
      const otherAddress = (await createAddress(ctx.prisma, otherId, 'Huế', true)).id;
      await subscribe('basic', undefined, otherId);
      const a = await book();
      const results = await Promise.all([borrow([a]), borrow([a], otherCookie, otherAddress)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('NO_COPY_AVAILABLE');
    });
  });

  describe('POST /loans/return', () => {
    async function activeLoans(count: number) {
      await subscribe('premium');
      const res = await borrow(await Promise.all(Array.from({ length: count }, () => book()))).expect(201);
      await markActive(ctx.prisma, res.body.loanIds);
      return res.body.loanIds as string[];
    }

    it('puts the loans on one free LOAN_PICKUP', async () => {
      const ids = await activeLoans(2);
      const res = await giveBack(ids).expect(201);
      const loans = await ctx.prisma.loan.findMany({ where: { id: { in: ids } } });
      expect(loans.every((l) => l.status === 'RETURN_REQUESTED' && l.returnShipmentId === res.body.shipmentId)).toBe(true);
      expect(await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: res.body.shipmentId } })).toMatchObject({
        type: 'LOAN_PICKUP',
        fee: 0,
        status: 'PENDING',
      });
    });

    it('refuses loans that are not ACTIVE or not the caller’s, changing nothing', async () => {
      await subscribe('premium');
      const requested = (await borrow([await book()]).expect(201)).body.loanIds as string[];
      expect((await giveBack(requested).expect(409)).body.code).toBe('LOAN_NOT_RETURNABLE');
      await markActive(ctx.prisma, requested);
      const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      const otherAddress = (await createAddress(ctx.prisma, await userIdByEmail(ctx.prisma, 'other@test.vn'), 'Huế', true)).id;
      expect((await giveBack(requested, other, otherAddress).expect(409)).body.code).toBe('LOAN_NOT_RETURNABLE');
      expect((await giveBack([...requested, 'khong-co']).expect(409)).body.code).toBe('LOAN_NOT_RETURNABLE');
      expect((await ctx.prisma.loan.findUniqueOrThrow({ where: { id: requested[0]! } })).status).toBe('ACTIVE');
      expect(await ctx.prisma.shipment.count({ where: { type: 'LOAN_PICKUP' } })).toBe(0);
    });

    it('still accepts returns after the subscription expired, while refusing new borrows', async () => {
      const ids = await activeLoans(1);
      await ctx.prisma.subscription.updateMany({ where: { userId }, data: { status: 'EXPIRED' } });
      expect((await borrow([await book()]).expect(409)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      await giveBack(ids).expect(201);
    });

    it('lets one of two overlapping returns win without a deadlock; the other changes nothing', async () => {
      const [a, b, c] = await activeLoans(3);
      const results = await Promise.all([giveBack([a!, b!]), giveBack([b!, c!])]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('LOAN_NOT_RETURNABLE');
      const statuses = Object.fromEntries(
        (await ctx.prisma.loan.findMany({ where: { id: { in: [a!, b!, c!] } } })).map((l) => [l.id, l.status]),
      );
      const won = results[0]!.status === 201 ? [a, b] : [b, c];
      const lost = results[0]!.status === 201 ? c : a;
      for (const id of won) expect(statuses[id!]).toBe('RETURN_REQUESTED');
      expect(statuses[lost!]).toBe('ACTIVE');
    });
  });

  describe('GET /loans', () => {
    it('lists the caller’s loans newest first with book and tracked shipment status', async () => {
      await subscribe('premium');
      const first = (await borrow([await book()]).expect(201)).body;
      await markActive(ctx.prisma, first.loanIds);
      const pickup = (await giveBack(first.loanIds).expect(201)).body.shipmentId as string;
      await ctx.prisma.shipment.update({ where: { id: pickup }, data: { status: 'PICKED_UP' } });
      const second = (await borrow([await book()]).expect(201)).body;
      await ctx.prisma.shipment.update({ where: { id: second.shipmentId }, data: { status: 'FAILED' } });
      await ctx.prisma.loan.updateMany({ where: { id: { in: second.loanIds } }, data: { status: 'CANCELLED' } });

      const res = await request(ctx.http).get('/api/loans').set('Cookie', customer).expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(res.body.items.map((l: { id: string }) => l.id)).toEqual([second.loanIds[0], first.loanIds[0]]);
      expect(res.body.items[0]).toMatchObject({ status: 'CANCELLED', shipmentStatus: 'FAILED', returnedAt: null });
      expect(res.body.items[1]).toMatchObject({ status: 'RETURN_REQUESTED', shipmentStatus: 'PICKED_UP' });
      expect(res.body.items[1].book).toEqual({ title: expect.any(String), slug: expect.any(String), coverUrl: null });
      expect(typeof res.body.items[1].deliveredAt).toBe('string');
    });

    it('pages by 20 and shows nobody else’s loans', async () => {
      await subscribe('premium');
      await ctx.prisma.plan.update({ where: { id: plans.premium.id }, data: { maxBooks: 30 } });
      for (let i = 0; i < 21; i++) await borrow([await book()]).expect(201);
      const second = await request(ctx.http).get('/api/loans?page=2').set('Cookie', customer).expect(200);
      expect(second.body).toMatchObject({ total: 21, page: 2 });
      expect(second.body.items).toHaveLength(1);
      const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      expect((await request(ctx.http).get('/api/loans').set('Cookie', other).expect(200)).body.total).toBe(0);
    });
  });
});
