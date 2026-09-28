import request from 'supertest';
import { RevalidationService } from '../src/revalidation/revalidation.service';
import { ShipmentsService } from '../src/shipments/shipments.service';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { ADDRESS_INPUT, createAddress, userIdByEmail } from './order-fixtures';
import { createPlans, createSubscription } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('loan shipments', () => {
  let ctx: TestContext;
  let customer: string;
  let admin: string;
  let userId: string;
  let addressId: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    admin = await loginAs(ctx, 'ADMIN');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
    const plans = await createPlans(ctx.prisma);
    await createSubscription(ctx.prisma, { userId, planId: plans.premium.id });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const book = async () => createBook(ctx.prisma, categoryId, { title: `Sách ${Math.random()}`, copies: ['AVAILABLE'] });
  const borrow = async (count = 2) => {
    const books = await Promise.all(Array.from({ length: count }, () => book()));
    const res = await request(ctx.http)
      .post('/api/loans')
      .set('Cookie', customer)
      .send({ bookIds: books.map((b) => b.id), addressId })
      .expect(201);
    return { ...(res.body as { loanIds: string[]; shipmentId: string }), books };
  };
  const giveBack = async (loanIds: string[]) =>
    (await request(ctx.http).post('/api/loans/return').set('Cookie', customer).send({ loanIds, addressId }).expect(201)).body
      .shipmentId as string;
  const patch = (id: string, status: string) =>
    request(ctx.http).patch(`/api/admin/shipments/${id}`).set('Cookie', admin).send({ status });
  const walk = async (id: string) => {
    for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED']) await patch(id, status).expect(200);
  };
  const fail = (id: string) => patch(id, 'FAILED').expect(200);
  const retry = (id: string) => request(ctx.http).post(`/api/admin/shipments/${id}/retry`).set('Cookie', admin).send({});
  const cancel = (id: string, cookie = admin) =>
    request(ctx.http).post(`/api/admin/shipments/${id}/cancel-loans`).set('Cookie', cookie).send({});
  const loans = (ids: string[]) => ctx.prisma.loan.findMany({ where: { id: { in: ids } }, include: { bookCopy: true }, orderBy: { id: 'asc' } });

  it('delivers, then takes back: loan and copy statuses follow each shipment', async () => {
    const { loanIds, shipmentId, books } = await borrow(2);
    await patch(shipmentId, 'PICKED_UP').expect(200);
    expect((await loans(loanIds)).every((l) => l.status === 'REQUESTED')).toBe(true);
    await patch(shipmentId, 'IN_TRANSIT').expect(200);
    await patch(shipmentId, 'DELIVERED').expect(200);
    let rows = await loans(loanIds);
    expect(rows.every((l) => l.status === 'ACTIVE' && l.deliveredAt && l.bookCopy.status === 'ON_LOAN')).toBe(true);
    const detail = await request(ctx.http).get(`/api/books/${books[0]!.slug}`).expect(200);
    expect(detail.body.availableCopies).toBe(0);

    const pickup = await giveBack(loanIds);
    await walk(pickup);
    rows = await loans(loanIds);
    expect(rows.every((l) => l.status === 'RETURNED' && l.returnedAt && l.bookCopy.status === 'AVAILABLE')).toBe(true);
    const mine = await request(ctx.http).get('/api/loans').set('Cookie', customer).expect(200);
    expect(mine.body.items.every((l: { shipmentStatus: string }) => l.shipmentStatus === 'DELIVERED')).toBe(true);
  });

  it('keeps loans REQUESTED when the delivery fails, and cancel-loans frees the copies, idempotently', async () => {
    const spy = jest.spyOn(ctx.app.get(RevalidationService), 'catalogChanged').mockResolvedValue(undefined);
    const { loanIds, shipmentId } = await borrow(2);
    await fail(shipmentId);
    expect((await loans(loanIds)).every((l) => l.status === 'REQUESTED' && l.bookCopy.status === 'RESERVED')).toBe(true);
    spy.mockClear();
    const res = await cancel(shipmentId).expect(200);
    expect(res.body).toMatchObject({ id: shipmentId, status: 'FAILED' });
    expect((await loans(loanIds)).every((l) => l.status === 'CANCELLED' && l.bookCopy.status === 'AVAILABLE')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    await cancel(shipmentId).expect(200);
    const mine = await request(ctx.http).get('/api/loans').set('Cookie', customer).expect(200);
    expect(mine.body.items.every((l: { status: string; shipmentStatus: string }) => l.status === 'CANCELLED' && l.shipmentStatus === 'FAILED')).toBe(true);
  });

  it('moves the loans to the retry; cancelling the old shipment is then refused', async () => {
    const { loanIds, shipmentId } = await borrow(2);
    await fail(shipmentId);
    const next = (await retry(shipmentId).expect(201)).body.id as string;
    expect((await loans(loanIds)).every((l) => l.deliveryShipmentId === next && l.status === 'REQUESTED')).toBe(true);
    expect((await cancel(shipmentId).expect(409)).body.code).toBe('LOAN_NOT_CANCELLABLE');
    await walk(next);
    expect((await loans(loanIds)).every((l) => l.status === 'ACTIVE')).toBe(true);
  });

  it('refuses to retry a delivery whose loans were cancelled, creating nothing', async () => {
    const { shipmentId } = await borrow(1);
    await fail(shipmentId);
    await cancel(shipmentId).expect(200);
    expect((await retry(shipmentId).expect(409)).body.code).toBe('INVALID_SHIPMENT_TRANSITION');
    expect(await ctx.prisma.shipment.count()).toBe(1);
  });

  it('lets exactly one of a concurrent retry and cancel-loans win', async () => {
    const { loanIds, shipmentId } = await borrow(2);
    await fail(shipmentId);
    const [retried, cancelled] = await Promise.all([retry(shipmentId), cancel(shipmentId)]);
    const rows = await loans(loanIds);
    if (retried.status === 201) {
      expect(cancelled.status).toBe(409);
      expect(cancelled.body.code).toBe('LOAN_NOT_CANCELLABLE');
      expect(rows.every((l) => l.status === 'REQUESTED' && l.deliveryShipmentId === retried.body.id)).toBe(true);
      expect(await ctx.prisma.shipment.count()).toBe(2);
    } else {
      expect(retried.status).toBe(409);
      expect(cancelled.status).toBe(200);
      expect(rows.every((l) => l.status === 'CANCELLED' && l.bookCopy.status === 'AVAILABLE')).toBe(true);
      expect(await ctx.prisma.shipment.count()).toBe(1);
    }
  });

  it('refuses cancel-loans on anything but a FAILED LOAN_DELIVERY', async () => {
    const { loanIds, shipmentId } = await borrow(1);
    expect((await cancel(shipmentId).expect(409)).body.code).toBe('LOAN_NOT_CANCELLABLE'); // PENDING
    await walk(shipmentId);
    const pickup = await giveBack(loanIds);
    await fail(pickup);
    expect((await cancel(pickup).expect(409)).body.code).toBe('LOAN_NOT_CANCELLABLE'); // LOAN_PICKUP
    const order = await ctx.prisma.order.create({
      data: { userId, status: 'PAID', subtotal: 0, shippingFee: 20_000, total: 20_000, addressSnapshot: ADDRESS_INPUT },
    });
    const delivery = await ctx.app.get(ShipmentsService).create(ctx.prisma, {
      type: 'ORDER_DELIVERY',
      orderId: order.id,
      fee: 20_000,
      addressSnapshot: ADDRESS_INPUT,
    });
    await fail(delivery.id);
    expect((await cancel(delivery.id).expect(409)).body.code).toBe('LOAN_NOT_CANCELLABLE'); // ORDER_DELIVERY
    await cancel('khong-co').expect(404);
    await cancel(shipmentId, customer).expect(403);
  });

  it('moves returns to a retried pickup', async () => {
    const { loanIds, shipmentId } = await borrow(1);
    await walk(shipmentId);
    const pickup = await giveBack(loanIds);
    await fail(pickup);
    const next = (await retry(pickup).expect(201)).body.id as string;
    expect((await loans(loanIds))[0]).toMatchObject({ status: 'RETURN_REQUESTED', returnShipmentId: next });
    await walk(next);
    expect((await loans(loanIds))[0]).toMatchObject({ status: 'RETURNED' });
  });

  it('rolls the delivery back with 500 when a copy is out of step with its loan', async () => {
    const { loanIds, shipmentId } = await borrow(1);
    await patch(shipmentId, 'PICKED_UP').expect(200);
    await patch(shipmentId, 'IN_TRANSIT').expect(200);
    const [loan] = await loans(loanIds);
    await ctx.prisma.bookCopy.update({ where: { id: loan!.bookCopyId }, data: { status: 'AVAILABLE' } });
    expect((await patch(shipmentId, 'DELIVERED').expect(500)).body.code).toBe('INTERNAL_ERROR');
    expect((await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).status).toBe('IN_TRANSIT');
    expect((await loans(loanIds))[0]!.status).toBe('REQUESTED');
  });

  describe('GET /admin/loans', () => {
    it('lists newest first and filters by status and by delivery or return shipment', async () => {
      const first = await borrow(1);
      await walk(first.shipmentId);
      const pickup = await giveBack(first.loanIds);
      const second = await borrow(1);
      const list = (query = '') => request(ctx.http).get(`/api/admin/loans${query}`).set('Cookie', admin).expect(200);

      const all = await list();
      expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(all.body.items.map((l: { id: string }) => l.id)).toEqual([second.loanIds[0], first.loanIds[0]]);
      expect(all.body.items[1]).toMatchObject({
        customerEmail: 'customer@test.vn',
        bookTitle: first.books[0]!.title,
        status: 'RETURN_REQUESTED',
        deliveryShipmentId: first.shipmentId,
        returnShipmentId: pickup,
      });
      expect(typeof all.body.items[1].barcode).toBe('string');
      expect((await list('?status=REQUESTED')).body.items.map((l: { id: string }) => l.id)).toEqual(second.loanIds);
      expect((await list(`?shipmentId=${first.shipmentId}`)).body.items.map((l: { id: string }) => l.id)).toEqual(first.loanIds);
      expect((await list(`?shipmentId=${pickup}`)).body.items.map((l: { id: string }) => l.id)).toEqual(first.loanIds);
      expect((await list('?status=abc&shipmentId=&page=-2')).body.total).toBe(2);
    });

    it('forbids customers (403)', async () => {
      await request(ctx.http).get('/api/admin/loans').set('Cookie', customer).expect(403);
    });
  });

  it('refuses to delete a book that has been lent with 409 IN_USE', async () => {
    const { books } = await borrow(1);
    const res = await request(ctx.http).delete(`/api/admin/books/${books[0]!.id}`).set('Cookie', admin).send({}).expect(409);
    expect(res.body.code).toBe('IN_USE');
  });
});
